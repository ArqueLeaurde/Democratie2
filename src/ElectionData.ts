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
  reason: string
  phase: ElectionPhase
  endsCandidacyAt: number
  endsVotingAt?: number
  candidates: Candidate[]
  votes: ElectionVote[]
  messageId?: Snowflake
}
