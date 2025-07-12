import { CommandoClient } from 'discord.js-commando'
import VoteAliasCommand from '../abstract/VoteAliasCommand'

export default class AbstainCommand extends VoteAliasCommand {
  protected state: 1 | 0 | -1 = 0

  constructor (client: CommandoClient) {
    super(client, {
      name: 'abstain',
      aliases: ['blanc', 'abs', 'sitout', 'sit-out'],
      description: 'Voter blanc sur une motion en cours.',

      args: [
        {
          key: 'reason',
          prompt: 'Raison pour ce vote',
          type: 'string',
          default: ''
        }
      ]
    })
  }
}
