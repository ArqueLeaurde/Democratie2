import { CommandoClient } from 'discord.js-commando'
import VoteAliasCommand from '../abstract/VoteAliasCommand'

export default class YesCommand extends VoteAliasCommand {
  protected state: 1 | 0 | -1 = 1

  constructor (client: CommandoClient) {
    super(client, {
      name: 'yes',
      aliases: ['pour', 'aye', 'si', 'yea', 'yay', 'ja', 'oui', 'da', 'да'],
      description: 'Voter oui pour la motion en cours.',

      args: [
        {
          key: 'reason',
          prompt: 'La raison pour ce vote',
          type: 'string',
          default: ''
        }
      ]
    })
  }
}
