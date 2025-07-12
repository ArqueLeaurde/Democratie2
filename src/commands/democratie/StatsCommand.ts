import { Message } from "discord.js"
import { CommandoClient, CommandoMessage } from "discord.js-commando"
import { MotionResolution } from "../../Motion"
import Command from "../Command"

interface TimeStat {
  authorId: string
  authorName: string
  timestamp: number
}

function timeSince(date: number, zeroReplacement?: string) {
  if (zeroReplacement != null && date === 0) {
    return zeroReplacement
  }

  const seconds = Math.floor((Date.now() - date) / 1000)

  let interval = Math.floor(seconds / 31536000)

  if (interval >= 1) {
    return interval + " years ago"
  }
  interval = Math.floor(seconds / 2592000)
  if (interval >= 1) {
    return interval + " months ago"
  }
  interval = Math.floor(seconds / 86400)
  if (interval >= 1) {
    return interval + " days ago"
  }
  interval = Math.floor(seconds / 3600)
  if (interval >= 1) {
    return interval + " hours ago"
  }
  interval = Math.floor(seconds / 60)
  if (interval >= 1) {
    return interval + " minutes ago"
  }
  return Math.floor(seconds) + " seconds ago"
}

export default class StatsCommand extends Command {
  constructor(client: CommandoClient) {
    super(client, {
      name: "councilstats",
      aliases: ["votestats", "votumstats"],
      description: "Affiche quelques statistiques à propos des votes dans votre conseil.",
      adminOnly: true,
    })
  }

  async execute(msg: CommandoMessage, args: any): Promise<Message | Message[]> {
    await msg.guild.members.fetch() // Privileged intents fix
    const lastVoted: { [index: string]: number } = {}
    const lastMotion: { [index: string]: number } = {}
    const mostMotions: { [index: string]: number } = {}
    const mostPassedMotions: { [index: string]: number } = {}
    const councilorNames: { [index: string]: string } = {}

    this.council.members
      .filter((member) => !member.user.bot)
      .forEach((member) => {
        lastVoted[member.id] = 0
        lastMotion[member.id] = 0
        councilorNames[member.id] = member.displayName
      })

    /////////////////////////////////////////////////////////

    for (let i = 0; i < this.council.numMotions; i++) {
      const motion = this.council.getMotion(i)

      if (
        lastMotion[motion.authorId] == null ||
        lastMotion[motion.authorId] < motion.createdAt
      ) {
        lastMotion[motion.authorId] = motion.createdAt

        if (councilorNames[motion.authorId] == null) {
          councilorNames[motion.authorId] = motion.authorName + " (retired)"
        }
      }

      if (mostMotions[motion.authorId] == null) mostMotions[motion.authorId] = 0
      mostMotions[motion.authorId]++

      if (motion.resolution === MotionResolution.Passed) {
        if (mostPassedMotions[motion.authorId] == null)
          mostPassedMotions[motion.authorId] = 0
        mostPassedMotions[motion.authorId]++
      }

      for (const vote of motion.votes) {
        // If this is a quoted vote
        if (vote.authorId === "0") {
          continue
        }

        if (
          lastVoted[vote.authorId] == null ||
          lastVoted[vote.authorId] < motion.createdAt
        ) {
          lastVoted[vote.authorId] = motion.createdAt

          if (councilorNames[vote.authorId] == null) {
            councilorNames[vote.authorId] = vote.authorName + " (retired)"
          }
        }
      }
    }

    /////////////////////////////////////////////////////////

    let output = "**__Démocratie Stats__**\n\n"
    output += `**Nombre total de motions crées:** ${this.council.numMotions}\n`

    ////////////

    let highestMotionAuthor = "no one"
    let highestMotion = 0
    for (const [authorId, num] of Object.entries(mostMotions)) {
      if (num > highestMotion) {
        highestMotion = num
        highestMotionAuthor = councilorNames[authorId]
      }
    }
    output += `**Le plus de motions crées**: ${highestMotionAuthor} (${highestMotion})`

    let highestPassedMotionAuthor = "no one"
    let highestPassedMotion = 0
    for (const [authorId, num] of Object.entries(mostPassedMotions)) {
      if (num > highestPassedMotion) {
        highestPassedMotion = num
        highestPassedMotionAuthor = councilorNames[authorId]
      }
    }
    output += `\n**Le plus de motions approuvées**: ${highestPassedMotionAuthor} (${highestPassedMotion})`

    ////////////

    const voteTimeStats: TimeStat[] = []
    for (const [authorId, timestamp] of Object.entries(lastVoted)) {
      voteTimeStats.push({
        authorName: councilorNames[authorId],
        authorId,
        timestamp,
      })
    }

    voteTimeStats.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    output +=
      "\n\n**Temps depuis le dernier vote**" +
      voteTimeStats.reduce(
        (a, stat) =>
          `${a}\n${stat.authorName}: ${timeSince(
            stat.timestamp,
            "jamais voté"
          )}`,
        ""
      )

    ////////////

    const motionTimeStats: TimeStat[] = []
    for (const [authorId, timestamp] of Object.entries(lastMotion)) {
      motionTimeStats.push({
        authorName: councilorNames[authorId],
        authorId,
        timestamp,
      })
    }

    motionTimeStats.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    output +=
      "\n\n**Temps depuis la dernière motion**" +
      motionTimeStats.reduce(
        (a, stat) =>
          `${a}\n${stat.authorName}: ${timeSince(
            stat.timestamp,
            "aucune motion n'a été créée"
          )}`,
        ""
      )

    /////////////////////////////////////////////////////////

    return msg.reply(output, { split: true })
  }
}
