import * as Discord from "discord.js"
import { Intents } from "discord.js"
import * as Commando from "discord.js-commando"
import * as path from "path"
import Command from "./commands/Command"
import Council from "./Council"
import { CastVoteStatus } from "./Motion"

require("dotenv").config()

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", reason instanceof Error ? reason.stack : reason)
  // console.error("Unhandled Rejection at:", reason.stack || reason) --> Couldn't know if null or undefined
  // Recommended: send the information to sentry.io
  // or whatever crash reporting service you use
})

const REACTION_VOTE_MAP: { [key: string]: { state: 1 | 0 | -1; name: string } } = {
  '👍': { state: 1, name: 'Pour' },
  '👎': { state: -1, name: 'Contre' },
  '🏳️': { state: 0, name: 'Blanc' },
}

class Democratie {
  public bot: Commando.CommandoClient
  private councilMap: Map<Discord.Snowflake, Council>

  constructor() {
    this.bot = new Commando.CommandoClient({
      owner: process.env.OWNER,
      // disabledEvents: [
      //   "TYPING_START",
      //   "VOICE_STATE_UPDATE",
      //   "PRESENCE_UPDATE",
      //   "MESSAGE_DELETE",
      //   "MESSAGE_UPDATE",
      //   "CHANNEL_PINS_UPDATE",
      //   "MESSAGE_REACTION_ADD",
      //   "MESSAGE_REACTION_REMOVE",
      //   "MESSAGE_REACTION_REMOVE_ALL",
      //   "CHANNEL_PINS_UPDATE",
      //   "MESSAGE_DELETE_BULK",
      //   "WEBHOOKS_UPDATE",
      // ] as any,
  
    ws: {
      // intents adapted for old modules versions
      intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,  // absolutely needed for reactions management !
      ],
    },

    // partials needed 
    partials: [
      "MESSAGE",
      "CHANNEL",
      "REACTION",
      "USER",
    ] as any, // cast for TS 3.9.7
        commandEditableDuration: 120,
      })

    this.councilMap = new Map()
    ;(this.bot as any).democratie = this
    this.registerCommands()

    this.bot.on("ready", () => {
      console.log("La démocratie est LÀ.")

      this.setActivity()
      setInterval(this.setActivity.bind(this), 1000000)
    })

    // reactions management
    this.bot.on('messageReactionAdd', this.onReactionAdd.bind(this))
    this.bot.on('messageReactionRemove', this.onReactionRemove.bind(this))

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
      throw new Error("Ce salon existe pas.")
    }

    const council = new Council(channel as Discord.TextChannel)
    this.councilMap.set(id, council)

    return council
  }

  private async onReactionAdd(
    reaction: Discord.MessageReaction,
    user: Discord.User | Discord.PartialUser
  ) {
    // Ignore bots and wait for mandatory information
    if (user.bot) return
    if (reaction.partial) await reaction.fetch()
    if (user.partial) await user.fetch()

    const council = this.getCouncil(reaction.message.channel.id)
    if (!council.currentMotion || council.currentMotion.messageId !== reaction.message.id) {
      return 
    }
    
    const motion = council.currentMotion
    const emojiName = reaction.emoji.name
    
    const voteType = REACTION_VOTE_MAP[emojiName]
    if (!voteType) return // not a voting emote

    // make sure the user can only have one reaction at a time
    const member = await reaction.message.guild?.members.fetch(user.id)
    if (!member) return

    for (const emoji in REACTION_VOTE_MAP) {
      if (emoji !== emojiName) {
        const otherReaction = reaction.message.reactions.cache.get(emoji)
        if (otherReaction && otherReaction.users.cache.has(user.id)) {
          await otherReaction.users.remove(user.id)
        }
      }
    }
    
   // cast vote and get status
    const status = motion.castVote({
      authorId: user.id,
      authorName: member.displayName,
      name: `${voteType.name} (réaction)`,
      state: voteType.state,
      reason: '',
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
    if (!council.currentMotion || council.currentMotion.messageId !== reaction.message.id) {
      return
    }

    const emojiName = reaction.emoji.name
    const voteType = REACTION_VOTE_MAP[emojiName]
    if (!voteType) return
    
    // remove user's vote
    council.currentMotion.retractVote(user.id)
  }

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
        help: false, //Custom Help pannel added, base help command deactivated
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
