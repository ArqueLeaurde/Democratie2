import {
  Channel,
  Collection,
  GuildMember,
  Message,
  Snowflake,
  TextChannel,
} from "discord.js"
import { Either } from "fp-ts/lib/Either"
import * as t from "io-ts"
import minimist from "minimist"
import num2fraction from "num2fraction"
import calculateVoteTotals from "./calculateVoteTotals"
import Council, { CouncilWeights } from "./Council"
import { OnFinishAction } from "./CouncilData"
import {
  MotionData,
  MotionMetaOptions,
  MotionOptions,
  MotionVote,
} from "./MotionData"
import { forwardMotion } from "./Util"
import Democratie from "./Democratie"

export enum LegacyMotionVoteType {
  Majority,
  Unanimous,
}
export enum MotionResolution {
  Unresolved,
  Killed,
  Passed,
  Failed,
}
export enum CastVoteStatus {
  New,
  Changed,
  Failed,
}

const DEFAULT_MAJORITY = 0.5

interface EmbedField {
  name: string
  value: string
  inline?: boolean
}

function getEmbedLength(embed: any): number {
  return JSON.stringify(embed).length
}

export default class Motion {
  public council: Council
  public motionIndex: number
  private weights?: CouncilWeights
  private data: MotionData
  private creatingChannelPromise?: Promise<unknown>

  // save message id to vote with reactions
  public get messageId(): Snowflake | undefined {
    return this.data.messageId
  }

  static parseMotionOptions(
    input: string
  ): Either<t.Errors, [string, MotionOptions]> {
    const args = minimist<
      MotionMetaOptions & { [K in keyof MotionOptions]: string }
    >(input.split(" "), {
      stopEarly: true,
      boolean: ["unanimous"],
      alias: {
        u: "unanimous",
        m: "majority",
      },
    })

    if (args.unanimous) {
      args.majority = "100%"
    }

    return MotionOptions.decode(args).map(
      (options): [string, MotionOptions] => [args._.join(" "), options]
    )
  }

  constructor(motionIndex: number, motionData: MotionData, council: Council) {
    this.data = motionData
    this.council = council
    this.motionIndex = motionIndex
  }

  public get authorId(): Snowflake {
    return this.data.authorId
  }

  public get authorName(): string {
    return this.data.authorName
  }

  public get number(): number {
    return this.motionIndex + 1
  }

  public get isExpired(): boolean {
    return !!(
      this.council.motionExpiration &&
      Date.now() - this.data.createdAt > this.council.motionExpiration
    )
  }

  public get votes(): MotionVote[] {
    return this.data.votes
  }

  public get createdAt(): number {
    return this.data.createdAt
  }

  public set createdAt(when: number) {
    this.data.createdAt = when
  }

  public get text(): string {
    return this.data.text
  }

  public get resolution(): MotionResolution {
    return this.data.resolution
  }

  public get requiredMajority(): number {
    if (!this.data.options) {
      return this.council.getConfig("majorityDefault") || DEFAULT_MAJORITY
    }

    return (
      this.data.options.majority ||
      this.council.getConfig("majorityDefault") ||
      DEFAULT_MAJORITY
    )
  }

  public getData() {
    return this.data
  }

  public getReadableMajority(): string {
    if (this.requiredMajority === 1) {
      return "Unanime"
    }

    switch (this.requiredMajority) {
      case 1:
        return "Unanime"
      case 0.5:
        return "Majorité simple"
      default:
        return num2fraction(this.requiredMajority)
    }
  }

  private async generateTranscript() {
    if (!this.data.deliberationChannelId) {
      return
    }

    const channel = this.council.channel.guild.channels.cache.find(
      (channel) => channel.id === this.data.deliberationChannelId
    ) as TextChannel | undefined

    if (!channel) {
      return
    }

    const messages: string[] = []
    let lastId: string | undefined

    for (let i = 0; i < 50; i++) {
      const collection = await channel.messages.fetch({
        limit: 50,
        ...(lastId && {
          before: lastId,
        }),
      })

      const batch = collection.array()

      for (const message of batch) {
        if (message.author.bot) {
          continue
        }

        messages.push(
          `${new Date(message.createdTimestamp).toISOString()} <${
            message.author.tag
          }> ${message.content.replace(/(\n\n+)/g, "\n")}`
        )
      }

      if (batch.length < 50) {
        break
      }

      lastId = batch[batch.length - 1].id
    }

    messages.reverse()

    const votes = this.getVotes()

    const header = [
      `Conseil : ${this.council.name}`,
      `Date : ${new Date().toISOString()}`,
      `Motion : #${this.number}`,
      `Résolution : ${MotionResolution[this.resolution]}`,
      `Proposée par : ${this.authorName}`,
      "",
      `Pour : ${votes.yes}`,
      `Contre : ${votes.no}`,
      `Blanc : ${votes.abs}`,
      "",
      "#".repeat(50),
      "",
      this.text,
      "",
      "#".repeat(50),
      "",
      [...this.data.votes]
        .map((vote) => `<${vote.authorName}> **${vote.name}** ${vote.reason}`)
        .join("\n\n"),
      "",
      "#".repeat(50),
    ]

    const transcript = [header.join("\n"), messages.join("\n\n")].join("\n\n")

    let postChannel = this.council.channel

    if (this.council.announceChannel) {
      postChannel =
        (this.council.channel.guild.channels.resolve(
          this.council.announceChannel
        ) as TextChannel) || postChannel
    }

    postChannel.send("", {
      files: [
        {
          name: `${this.council.name}-motion-${this.number}-transcript.txt`,
          attachment: Buffer.from(transcript),
        },
      ],
    })
  }

  private async deleteDeliberationChannel() {
    if (this.data.deliberationChannelId) {
      if (this.council.getConfig("keepTranscripts")) {
        await this.generateTranscript()
      }
      const channel = this.council.channel.guild.channels.cache.find(
        (channel) => channel.id === this.data.deliberationChannelId
      )

      if (channel) {
        this.data.deliberationChannelId = undefined
        channel.delete()
      }
    }
  }

  private async createDeliberationChannel() {
    if (this.resolution !== MotionResolution.Unresolved) {
      return
    }

    if (!this.council.getConfig("createDeliberationChannels")) {
      return
    }

    if (this.creatingChannelPromise) {
      await this.creatingChannelPromise.catch(() => {})
    }

    if (this.data.deliberationChannelId) {
      return
    }

    const guild = this.council.channel.guild

    const channelName = `motion-${this.number}`

    const channelPromise = guild.channels.create(channelName, {
      type: "text",
      parent: this.council.channel.parent as Channel,

      permissionOverwrites: this.council.channel.permissionOverwrites,
    })

    channelPromise.catch(console.error)

    this.creatingChannelPromise = channelPromise
    const channel = await channelPromise
    this.creatingChannelPromise = undefined

    this.data.deliberationChannelId = channel.id

    const motionMessage = await this.postMessage("", channel)

    const messages = Array.isArray(motionMessage)
      ? motionMessage
      : [motionMessage]

    for (const message of messages) {
      await message.pin()
    }
  }

  public async postMessage(
    text?: string | true,
    channel?: TextChannel
  ): Promise<Message | Message[]> {
    await this.council.channel.guild.members.fetch() // Privileged intents fix

    this.createDeliberationChannel()

    this.weights = await this.council.calculateWeights()

    let author

    try {
      author = await Democratie.bot.users.fetch(this.data.authorId)
    } catch (e) {
      // do nothing
    }

    if (this.data.active) {
      this.checkVotes()
    }

    let type = ""
    if (this.data.voteType === LegacyMotionVoteType.Unanimous) {
      type = " (unanimous)"
    }

    let title = `#${this.number} | `
    if (this.data.active) {
      if (text === true) {
        title += "Nouvelle motion proposée" + type
      } else {
        title += "Motion actuellement active" + type
      }
    } else if (this.data.resolution === MotionResolution.Passed) {
      title += "Motion Adoptée" + type
    } else if (this.data.resolution === MotionResolution.Killed) {
      title += "Motion Stoppée"
    } else {
      title += "Motion Rejetée"
    }

    const votes = text === true ? "" : "\n\n" + this.getVotesAsEmoji()

    let embeds: any[] = [
      {
        title,
        description: this.data.text.substring(0, 2000 - votes.length) + votes,
        author: {
          name: this.data.authorName,
          icon_url: author ? author.displayAvatarURL() : undefined,
        },
        color: this.data.active
          ? 0x3498db
          : this.data.resolution === MotionResolution.Passed
          ? 0x2ecc71
          : 0x636e72,
        fields: this.getVotesAsFields(),
        footer: {
          text: this.getVoteHint(),
        },
        thumbnail: {
          url: `http://assets.imgix.net/~text?txt=${encodeURIComponent(
            this.getReadableMajority()
          )}&txtclr=3498db&txtsize=20&h=50&txtfont=Georgia`,
        },
      },
    ]

    const isInvalid = (embed: any, extra = 0) =>
      embed.fields.length > 25 || getEmbedLength(embed) + extra >= 6000

    let currentIndex = 1
    while (isInvalid(embeds[0])) {
      const field = embeds[0].fields.pop()

      if (
        embeds[currentIndex] != null &&
        isInvalid(embeds[currentIndex], getEmbedLength(field))
      ) {
        currentIndex++
      }

      if (embeds[currentIndex] == null) {
        embeds[currentIndex] = {
          title: `${title} (cont.)`,
          color: embeds[0].color,
          fields: [],
        }
      }

      embeds[currentIndex].fields.push(field)
    }

    // changed postMessage to include reactions
    const targetChannel = channel || this.council.channel
    const sentMessages: Message[] = []

    for (const embed of embeds) {
      const sent = await targetChannel.send(
        typeof text !== "undefined"
          ? text === true
            ? this.council.mentionString
            : text
          : "",
        { embed }
      )
      // On ne peut pas garantir que `send` retourne un `Message` si le channel est un `NewsChannel`,
      // donc on le traite comme un tableau.
      const messages = Array.isArray(sent) ? sent : [sent];
      sentMessages.push(...messages);
    }
    
    const mainMessage = sentMessages[0]

    // if the motion is active, register ID and add reaction votes
    if (this.data.active && mainMessage) {
      this.data.messageId = mainMessage.id

      try {
        await mainMessage.react('👍')
        await mainMessage.react('👎')
        await mainMessage.react('🏳️')
      } catch (error) {
        console.error("Échec de l'ajout des réactions :", error)
      }
    }

    return sentMessages.length === 1 ? mainMessage : sentMessages
  }

  public castVote(newVote: MotionVote): CastVoteStatus {
    if (newVote.isDictator && newVote.state !== 0) {
      this.resolve(
        newVote.state === 1 ? MotionResolution.Passed : MotionResolution.Failed
      )
    }

    for (const [index, vote] of this.data.votes.entries()) {
      if (vote.authorId === newVote.authorId) {
        this.data.votes[index] = newVote
        return CastVoteStatus.Changed
      }
    }

    this.data.votes.push(newVote)

    this.checkVotes()
    return CastVoteStatus.New
  }

  // new method to remove votes
  public retractVote(authorId: Snowflake): void {
    const voteIndex = this.data.votes.findIndex(
      (vote) => vote.authorId === authorId
    )

    if (voteIndex > -1) {
      this.data.votes.splice(voteIndex, 1)
      this.postMessage(`Le vote de <@${authorId}> a été retiré.`)
    }
  }

  private getTotal(): number {
    return this.weights?.total || this.council.size
  }

  public getVotes(): {
    yes: number
    no: number
    abs: number
    toPass: number
    dictatorVoted: boolean
  } {
    return calculateVoteTotals({
      votes: this.data.votes,
      requiredMajority: this.requiredMajority,
      totalSize: this.getTotal(),
      weights: this.weights,
    })
  }

  public resolve(resolution: MotionResolution): void {
    if (this.data.active === false) {
      throw new Error("Tentative de réparation d'une motion résolue.")
    }

    this.data.active = false
    this.data.resolution = resolution
    this.data.didExpire = this.isExpired

    if (
      (resolution === MotionResolution.Failed ||
        resolution === MotionResolution.Passed) &&
      !this.council.getConfig("userCooldownKill")
    ) {
      this.council.setUserCooldown(this.data.authorId, this.data.createdAt)

      if (this.council.announceChannel) {
        this.postMessage(
          "",
          this.council.channel.guild.channels.cache.get(
            this.council.announceChannel
          ) as TextChannel
        )
      }
    }

    if (
      resolution === MotionResolution.Passed &&
      this.council.getConfig("onPassedAnnounce")
    ) {
      this.postMessage(
        "",
        this.council.channel.guild.channels.cache.get(
          this.council.getConfig("onPassedAnnounce")!
        ) as TextChannel
      )
    } else if (
      resolution === MotionResolution.Failed &&
      this.council.getConfig("onFailedAnnounce")
    ) {
      this.postMessage(
        "",
        this.council.channel.guild.channels.cache.get(
          this.council.getConfig("onFailedAnnounce")!
        ) as TextChannel
      )
    } else if (
      resolution === MotionResolution.Killed &&
      this.council.getConfig("onKilledAnnounce")
    ) {
      this.postMessage(
        "",
        this.council.channel.guild.channels.cache.get(
          this.council.getConfig("onKilledAnnounce")!
        ) as TextChannel
      )
    }

    const newCurrentMotion = this.council.currentMotion
    if (newCurrentMotion) {
      newCurrentMotion.createdAt = Date.now()
      setTimeout(
        () =>
          newCurrentMotion
            .postMessage(true)
            .then(() => undefined)
            .catch((e) => {
              throw e
            }),
        2000
      )
    }

    this.deleteDeliberationChannel()

    const actions = this.council.getConfig("onFinishActions") as any
    if (!actions) return

    switch (resolution) {
      case MotionResolution.Failed:
        if (actions.failed) this.performFinishActions(actions.failed)
        break
      case MotionResolution.Passed:
        if (actions.passed) this.performFinishActions(actions.passed)
        break
      case MotionResolution.Killed:
        if (actions.killed) this.performFinishActions(actions.killed)
        break
    }
  }

  public getRemainingVoters(): Collection<string, GuildMember> {
    const votedUsers: { [index: string]: true } = {}

    for (let vote of this.data.votes) {
      if (vote.state !== undefined) {
        votedUsers[vote.authorId] = true
      }
    }

    return this.council.members.filter(
      (member) => !votedUsers[member.id] && !member.user.bot
    )
  }

  private checkVotes(): void {
    if (this.resolution !== MotionResolution.Unresolved) {
      return
    }

    const votes = this.getVotes()

    if (this.isExpired) {
      if (votes.yes > votes.no) {
        this.resolve(MotionResolution.Passed)
      } else if (votes.no > votes.yes) {
        this.resolve(MotionResolution.Failed)
      }
    }

    if (
      this.council.getConfig("majorityReachedEnds") ||
      [...this.data.votes].filter((vote) => vote.state !== undefined).length ===
        this.council.size
    ) {
      if (votes.yes >= votes.toPass) {
        // Reached majority
        this.resolve(MotionResolution.Passed)
      } else if (
        this.data.voteType === LegacyMotionVoteType.Unanimous &&
        votes.no > 0
      ) {
        // Legacy unanimous
        this.resolve(MotionResolution.Failed)
      } else if (votes.no >= votes.toPass || votes.toPass === 0) {
        // If "no" has the majority...
        this.resolve(MotionResolution.Failed)
      } else if (this.getTotal() - (votes.no + votes.abs) < votes.toPass) {
        // If a majority could no longer be reached
        this.resolve(MotionResolution.Failed)
      }
    }
  }

  private getVoteHint(): string {
    const votes = this.getVotes()

    if (this.data.active === false) {
      return (
        `Résultats finaux.` +
        (this.data.voteType === LegacyMotionVoteType.Unanimous
          ? " (Vote unanime est nécessaire)"
          : "") +
        (this.data.didExpire ? " (Motion expirée.)" : "") +
        (votes.dictatorVoted ? " (Un Dictateur a terminé immédiatement le vote)" : "")
      )
    }

    if (votes.yes === votes.no && this.isExpired) {
      return `Cette motion est expirée, mais le résultat est ex aequo. Le prochain vote va terminer cette motion.`
    } else if (votes.yes === 0 && votes.no === 0) {
      return `Cette motion a besoin de ${votes.toPass} vote${
        votes.toPass === 1 ? "" : "s"
      } pour être Adoptée ou Rejetée.`
    } else if (
      (votes.yes >= votes.no && votes.yes >= votes.toPass) ||
      (votes.no >= votes.yes && votes.no >= votes.toPass)
    ) {
      return `Cette motion a atteint la majorité requise, mais elle est retenue jusqu’à ce que tous les votants aient voté.`
    } else if (votes.yes >= votes.no) {
      return `Avec ${votes.toPass - votes.yes} votes supplémentaires${
        votes.toPass - votes.yes === 1 ? "" : "s"
      } pour cette motion, elle sera Adoptée.`
    } else if (votes.no > votes.yes) {
      return `Avec ${votes.toPass - votes.no} votes supplémentaires${
        votes.toPass - votes.no === 1 ? "" : "s"
      } contre cette motion, elle sera Rejetée.`
    }

    return `Cette motion a besoin de ${votes.toPass} votes pour être Adoptée ou Rejetée.`
  }

  private getVotesAsEmoji(): string {
    const votes = this.getVotes()

    return `:thumbsup: **Pour** ${votes.yes}\n\n:thumbsdown: **Contre** ${votes.no}\n\n:flag_white: **Blanc** ${votes.abs}`
  }

  private getVotesAsFields(): EmbedField[] {
    const fields: EmbedField[] = []

    for (const vote of this.data.votes) {
      const weight = this.weights?.users[vote.authorId]
      fields.push({
        name: vote.authorName + (weight && weight > 1 ? ` [${weight}]` : ""),
        value: `**${vote.name}**  ${vote.reason || ""}`.substring(0, 1024),
        inline: true,
      })
    }

    return fields
  }

  private performFinishActions(actions: OnFinishAction[]) {
    actions = JSON.parse(JSON.stringify(actions))
    return Promise.all(
      actions
        .filter(
          (action) =>
            action.atMajority === undefined ||
            Math.abs(action.atMajority - this.requiredMajority) < 0.01
        )
        .map((action) => {
          switch (action.action) {
            case "forward":
              return forwardMotion(this, action.to, action.options)
          }
        })
    )
  }
}
