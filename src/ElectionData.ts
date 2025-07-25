import { Snowflake } from "discord.js"

export type ElectionPhase = "Candidacy" | "Voting" | "Finished"

export interface Candidate {
  id: Snowflake
  name: string
  reason: string
}

export interface ElectionVote {
  authorId: Snowflake
  candidateId: Snowflake
}

export interface ElectionData {
  id: string // NOUVEAU: ID unique pour l'élection (ex: "election-1")
  reason: string
  phase: ElectionPhase
  endsCandidacyAt: number
  endsVotingAt?: number
  candidates: Candidate[]
  votes: ElectionVote[]
  messageId?: Snowflake
  channelId: Snowflake // NOUVEAU: Pour savoir dans quel salon l'élection a lieu
}
