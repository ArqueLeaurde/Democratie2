import * as Discord from "discord.js"
import { Intents} from "discord.js"
import * as Commando from "discord.js-commando"
import * as path from "path"
import Command from "./commands/Command"
import Council from "./Council"
import { CastVoteStatus } from "./Motion"
import Election from "./Election"

require("dotenv").config()

process.on("unhandledRejection", (reason, promise) => {
  console.error(
    "Unhandled Rejection at:",
    reason instanceof Error ? reason.stack : reason
  )
})

const REACTION_VOTE_MAP: {
  [key: string]: { state: 1 | 0 | -1; name: string }
} = {
  "👍": { state: 1, name: "Pour" },
  "👎": { state: -1, name: "Contre" },
  "🏳️": { state: 0, name: "Blanc" },
}

class Democratie {
  public bot: Commando.CommandoClient
  private councilMap: Map<Discord.Snowflake, Council>
  public elections: Map<string, Election>

  constructor() {
    this.bot = new Commando.CommandoClient({
      owner: process.env.OWNER,
      ws: {
        intents: [
          Intents.FLAGS.GUILDS,
          Intents.FLAGS.GUILD_MEMBERS,
          Intents.FLAGS.GUILD_MESSAGES,
          Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        ],
      },
      partials: ["MESSAGE", "CHANNEL", "REACTION", "USER"] as any,
      commandEditableDuration: 120,
    })

    // maps pour le conseil et les élections
    this.councilMap = new Map()
    this.elections = new Map()

    // to access democratie from each command
    ;(this.bot as any).democratie = this

    this.registerCommands()

    this.bot.on("ready", () => {
      console.log("La démocratie est LÀ.")
      this.setActivity()
      setInterval(this.setActivity.bind(this), 1000000)
    })

    // reaction management for motions
    this.bot.on("messageReactionAdd", this.onReactionAdd.bind(this))
    this.bot.on("messageReactionRemove", this.onReactionRemove.bind(this))

    // reactions management for elections
    this.bot.on("messageReactionAdd",this.onReactionAddElection.bind(this))

    this.bot.login(process.env.TOKEN)
  }

  public static bootstrap(): Democratie {
    return ((global as any).Democratie = new Democratie())
  }

  public getCouncil(id: Discord.Snowflake): Council {
    if (this.councilMap.has(id)) {
      return this.councilMap.get(id)!
    }

    const channel = this.bot.channels.cache.get(id)
    if (channel == null) {
      throw new Error("Ce salon n'existe pas.")
    }

    const council = new Council(channel as Discord.TextChannel)
    this.councilMap.set(id, council)
    return council
  }

  //
  // ─── MOTIONS ─────────────────────────────────────────────────────────────────
  //

  private async onReactionAdd(
    reaction: Discord.MessageReaction,
    user: Discord.User | Discord.PartialUser
  ) {
    // Ignore bots and wait for mandatory information
    if (user.bot) return
    if (reaction.partial) await reaction.fetch()
    if (user.partial) await user.fetch()

    const council = this.getCouncil(reaction.message.channel.id)
    
    // Update Démocratie3: On ne vérifie plus "council.currentMotion".
    // On recherche la motion spécifique correspondant au message parmi toutes les motions actives.
    const motion = council.getActiveMotions().find(
      (m) => m.messageId === reaction.message.id
    )

    if (!motion) {
      return
    }

    const emojiName = reaction.emoji.name!
    const voteType = REACTION_VOTE_MAP[emojiName]
    if (!voteType) return

    const member = await reaction.message.guild!.members.fetch(user.id)
    // clean other reactions
    for (const emoji in REACTION_VOTE_MAP) {
      if (emoji !== emojiName) {
        const other = reaction.message.reactions.cache.get(emoji)
        if (other && other.users.cache.has(user.id)) {
          await other.users.remove(user.id)
        }
      }
    }

    // Check if user has already voted with the same option
    const existingVote = motion.getData().votes.find(v => v.authorId === user.id)
    if (existingVote && existingVote.state === voteType.state) {
      await motion.postMessage(`<@${user.id}> Vous avez déjà voté pour cette option (${voteType.name}).`)
      return
    }

    // cast and refresh
    const status = motion.castVote({
      authorId: user.id,
      authorName: member.displayName,
      name: `${voteType.name} (réaction)`,
      state: voteType.state,
      reason: "",
      isDictator: council.getConfig("dictatorRole")
        ? member.roles.cache.has(council.getConfig("dictatorRole")!)
        : false,
    })

    // refresh motion vote status
    switch (status) {
      case CastVoteStatus.New:
        await motion.postMessage()
        break
      case CastVoteStatus.Changed:
        await motion.postMessage(
          `<@${user.id}> a changé son vote en ${voteType.name}.`
        )
        break
      default:
        break
    }
  }

  // new method to get rid of the user's vote 
  private async onReactionRemove(
    reaction: Discord.MessageReaction,
    user: Discord.User | Discord.PartialUser
  ) {
    if (user.bot) return

    const council = this.getCouncil(reaction.message.channel.id)

    const motion = council.getActiveMotions().find(
      (m) => m.messageId === reaction.message.id
    )

    if (!motion) {
      return
    }

    const emojiName = reaction.emoji.name!
    const voteType = REACTION_VOTE_MAP[emojiName]
    if (!voteType) return

    motion.retractVote(user.id)
  }

  //
  // ─── ELECTIONS ────────────────────────────────────────────────────────────────
  //

  private async onReactionAddElection(
    reaction: Discord.MessageReaction,
    user: Discord.User | Discord.PartialUser
  ) {
    if (user.bot) return
    if (reaction.partial) await reaction.fetch()
    if (user.partial) await user.fetch()

      // find the election corresponding to the message
    const election = Array.from(this.elections.values()).find(
      (e) => e.data.messageId === reaction.message.id && e.data.phase === "Voting"
    );
    
    if (!election) return

    const msg = reaction.message

    // ensure a user can only vote once
    for (const emoji of election.emojis) {
      if (emoji !== reaction.emoji.name) {
        const other = msg.reactions.cache.get(emoji)
        if (other && other.users.cache.has(user.id)) {
          await other.users.remove(user.id)
        }
      }
    }

    election.castVote(user.id, reaction.emoji.name!)
  }

  //
  // ─── UTILS ───────────────────────────────────────────────────────────────
  //

  private setActivity(): void {
    this.bot.user?.setActivity("Votez bordel !")
  }

  private registerCommands(): void {
    this.bot.registry
      .registerGroup("democratie", "Democratie")
      .registerDefaultTypes()
      .registerDefaultGroups()
      .registerDefaultCommands({
        ping: false,
        commandState: false,
        prefix: false,
        help: false,
        unknownCommand: false,
      })
      .registerCommandsIn(path.join(__dirname, "./commands/democratie"))
      .registerTypesIn(path.join(__dirname, "./types"))

    this.bot.dispatcher.addInhibitor((msg) => {
      const council = this.getCouncil(msg.channel.id)
      if (
        council.enabled === false &&
        msg.command &&
        (msg.command as Command).councilOnly
      ) {
        return "outside_council"
      }
      return false
    })
  }
}

export default Democratie.bootstrap()