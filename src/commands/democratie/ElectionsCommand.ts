import Discord from "discord.js"
import { TextChannel, Message } from "discord.js"
import { CommandoClient, CommandoMessage } from "discord.js-commando"
import Command from "../Command"
import Election from "../../Election"
import { ElectionData } from "../../ElectionData"

type Args = {
  reason: string
  candDur: number
  voteDur: number
}

export default class ElectionsCommand extends Command {
  constructor(client: CommandoClient) {
    super(client, {
      name: "elections",
      description: "Lance une élection ou affiche l’état actuel",
      args: [
        {
          key: "reason",
          prompt: "Quel est le motif de l’élection ?",
          type: "string",
          default: ""
        },
        {
          key: "candDur",
          prompt: "Durée phase de candidature (minutes) ?",
          type: "integer",
          default: 0
        },
        {
          key: "voteDur",
          prompt: "Durée phase de vote (minutes) ?",
          type: "integer",
          default: 0
        }
      ],
      adminOnly: true
    })
  }

  async run(
    msg: CommandoMessage,
    args: Args
  ): Promise<Message | Message[]> {
    // get active election
    const democratie = (this.client as any).democratie as {
      currentElection?: Election
    }
    const active = democratie.currentElection

    // !elections kill
    if (args.reason.toLowerCase() === "kill") {
      if (!active || active.data.phase === "Finished") {
        return msg.reply("⚠️ Aucune élection active à interrompre.")
      }
      active.data.phase = "Finished"
      democratie.currentElection = undefined
      return msg.say("🛑 Élection annulée manuellement.")
    }

    // !elections without args
    const noArgs =
      args.reason.trim() === "" &&
      args.candDur === 0 &&
      args.voteDur === 0

    if (noArgs) {
      if (!active) {
        return msg.reply("ℹ️ Il n’y a actuellement **aucune** élection en cours.")
      }
      // stats display
      const embed = new Discord.MessageEmbed()
        .setColor("ORANGE")
        .setTitle("📊 État actuel des élections")
        .setDescription(`**Objet :** ${active.data.reason}`)

      if (active.data.phase === "Candidacy") {
        embed.setFooter(
          `Fin des candidatures <t:${Math.floor(
            active.data.endsCandidacyAt / 1000
          )}:R>`
        )
        embed.addField(
          "Candidats",
          active.data.candidates.length > 0
            ? active.data.candidates.map((c) => `• ${c.name}`).join("\n")
            : "Aucun candidat pour le moment",
          false
        )
      } else if (active.data.phase === "Voting") {
        embed.setFooter(
          `Fin du vote <t:${Math.floor(
            active.data.endsVotingAt! / 1000
          )}:R>`
        )
        active.data.candidates.forEach((c, i) => {
          const votesFor = active.data.votes.filter(
            (v) => v.candidateId === c.id
          ).length
          embed.addField(
            `${active.emojis[i]} ${c.name}`,
            `${votesFor} vote(s)`,
            true
          )
        })
      } else {
        embed.setFooter("Élection terminée")
        const resultLines = active.data.candidates
          .map((c) => {
            const count = active.data.votes.filter(
              (v) => v.candidateId === c.id
            ).length
            return `• ${c.name} : ${count} vote(s)`
          })
          .join("\n")
        embed.addField("Résultats", resultLines || "Aucun vote enregistré.")
      }

      return msg.embed(embed)
    }

    // incorrect settings
    if (
      args.reason.trim() === "" ||
      args.candDur <= 0 ||
      args.voteDur <= 0
    ) {
      return msg.reply(
        "❌ Usage incorrect. Exemple : `!elections \"Délégué de classe\" 10 20`"
      )
    }

    // can't launch election if one is already ative
    if (active && active.data.phase !== "Finished") {
      return msg.reply(
        "⚠️ Une élection est déjà en cours. Tapez `!elections kill` pour l’interrompre."
      )
    }

    // create new election
    const msCand = args.candDur * 60_000
    const msVote = args.voteDur * 60_000
    const endsCandidacyAt = Date.now() + msCand

    const data: ElectionData = {
      reason: args.reason,
      phase: "Candidacy",
      endsCandidacyAt,
      candidates: [],
      votes: []
    }

    const newElection = new Election(data, msg.channel as TextChannel)
    democratie.currentElection = newElection

    // creation message
    await msg.say(
      `📢 Élections ouvertes : **${args.reason}**\n` +
        `Candidatures jusqu’à <t:${Math.floor(
          endsCandidacyAt / 1000
        )}:R>`
    )
    await newElection.startCandidacy(msCand)

    // time left for candidates to apply
    setTimeout(async () => {
      // no candidates = end elections immediatly
      if (newElection.data.candidates.length === 0) {
        await msg.say(
          "⚠️ Aucune candidature reçue. Résultats immédiats."
        )
        await newElection.announceResults()
        democratie.currentElection = undefined
        return
      }

      // else vote phase starts
      await newElection.startVoting(msVote)

      // time left to vote
      setTimeout(() => {
        newElection.announceResults().catch(console.error)
        democratie.currentElection = undefined
      }, msVote)
    }, msCand)

    return msg.reply("🗳️ Phase de candidature lancée.")
  }
}
