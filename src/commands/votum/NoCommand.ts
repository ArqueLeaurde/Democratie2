import { CommandoClient } from 'discord.js-commando'
import VoteAliasCommand from '../abstract/VoteAliasCommand'

export default class NoCommand extends VoteAliasCommand {
  protected state: 1 | 0 | -1 = -1

  constructor (client: CommandoClient) {
    super(client, {
      name: 'no',
      aliases: ['contre', 'non', 'nay', 'negative', 'nope', 'nein', 'ne', 'не'],
      description: 'Vote non',

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
