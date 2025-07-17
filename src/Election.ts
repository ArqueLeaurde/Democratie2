import { TextChannel, MessageEmbed } from "discord.js"
import { ElectionData } from "./ElectionData"

export default class Election {
  public data: ElectionData
  private channel: TextChannel
  private readonly numberEmojis = [
    "1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"
  ]

  constructor(data: ElectionData, channel: TextChannel) {
    this.data = data
    this.channel = channel
  }

  public get emojis(): string[] {
    return this.numberEmojis.slice(0, this.data.candidates.length)
  }

  public async startCandidacy(candDurMs: number): Promise<void> {
    const embed = new MessageEmbed()
      .setTitle("🗳️ Phase de candidature ouverte")
      .setDescription(`Les candidatures pour : **${this.data.reason}** sont ouvertes !`)
      .setColor("BLUE")
      .setFooter(`Fin des candidatures dans ${Math.ceil(candDurMs/60000)} min.`)
      .addField("Comment postuler :", "Utilisez la commande appropriée `!candidat [raison]` pour soumettre votre candidature.")
    
    await this.channel.send({ embed })
  }

  public addCandidate(id: string, name: string, reason: string): void {
    if (this.data.phase !== "Candidacy") {
      throw new Error("Phase de candidature terminée")
    }
    if (!this.data.candidates.some(c => c.id === id)) {
      this.data.candidates.push({ id, name, reason })
    }
  }

  public async startVoting(voteDurMs: number): Promise<void> {
    if (this.data.phase !== "Candidacy") return
    this.data.phase = "Voting"
    this.data.endsVotingAt = Date.now() + voteDurMs

    const embed = new MessageEmbed()
      .setTitle("🗳️ Phase de vote")
      .setDescription(this.data.reason)
      .setColor("BLUE")
      .setFooter(`Fin dans ${Math.ceil(voteDurMs/60000)} min.`)

    if (this.data.candidates.length > 0) {
      this.data.candidates.forEach((c, i) =>
        embed.addField(`${this.numberEmojis[i]} ${c.name}`, c.reason, false)
      )
    } else {
      embed.addField("Aucun candidat", "Il n'y a pas eu de candidatures pour cette élection.", false)
    }

    const sent = await this.channel.send({ embed })
    this.data.messageId = sent.id
    for (const emoji of this.emojis) {
      await sent.react(emoji)
    }
  }

  public castVote(userId: string, emoji: string): void {
    if (this.data.phase !== "Voting") return
    const idx = this.numberEmojis.indexOf(emoji)
    if (idx < 0 || idx >= this.data.candidates.length) return
    this.data.votes = this.data.votes.filter(v => v.authorId !== userId)
    this.data.votes.push({
      authorId: userId,
      candidateId: this.data.candidates[idx].id,
    })
  }

  public async announceResults(): Promise<void> {
    if (this.data.phase !== "Voting") return
    this.data.phase = "Finished"

    const counts: Record<string, number> = {}
    this.data.candidates.forEach(c => (counts[c.id] = 0))
    this.data.votes.forEach(v => (counts[v.candidateId] += 1))

    const embed = new MessageEmbed()
      .setTitle("🏆 Résultats des élections") 
      .setColor("GREEN")
      .setDescription(`Résultats pour : **${this.data.reason}**`) 

    if (this.data.candidates.length > 0) {
      this.data.candidates
        .sort((a,b) => counts[b.id] - counts[a.id])
        .forEach(c =>
          embed.addField(c.name, `${counts[c.id]} vote(s)`, false)
        )
    } else {
      embed.addField("Aucun vote", "Aucun candidat, donc aucun vote n'a pu être enregistré.", false)
    }

    await this.channel.send({ embed })
  }
}