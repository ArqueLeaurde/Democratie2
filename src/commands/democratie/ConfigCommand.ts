import { Message } from "discord.js"
import { CommandoClient, CommandoMessage } from "discord.js-commando"
import {
  ConfigurableCouncilData,
  ConfigurableCouncilDataSerializers,
  OptionalCouncilData
} from "../../CouncilData"
import {
  getDefaultValue,
  getProps,
  parseType,
  response,
  ResponseType
} from "../../Util"
import Command from "../Command"

interface ConfigArguments {
  key: string
  value: string
}

const makeDisplay = (displayer?: (value: any) => string) => (value: any) => {
  if (value === undefined || value === null) {
    return "None"
  } else if (displayer) {
    return displayer(value)
  } else {
    return value.toString()
  }
}

export default class ConfigCommand extends Command {
  constructor(client: CommandoClient) {
    super(client, {
      name: "config",
      aliases: ["votumconfig", "cfg", "vconfig", "vcfg", "councilconfig"],
      description: "Désigne un rôle spécifique pour le(s) président(s) du conseil.",
      adminOnly: true,

      args: [
        {
          key: "key",
          prompt: "Quel configuration voulez-vous changer ?",
          type: "string",
          default: "",
        },
        {
          key: "value",
          prompt:
            "Quel valeur voulez-vous mettre à cette configuration ?",
          type: "string",
          default: "",
        },
      ],
    })
  }

  async execute(
    msg: CommandoMessage,
    args: ConfigArguments
  ): Promise<Message | Message[]> {
    if (args.key.length === 0) {
      return msg.reply(
        response(
          ResponseType.Neutral,
          `Configurations disponibles :\n${Object.keys(
            getProps(ConfigurableCouncilData)
          )
            .map((n) => `~${n}~`)
            .join(",\n ")}.`
        )
      )
    }

    const key = args.key.replace(/\.([a-z0-9])/g, (_, l) =>
      l.toUpperCase()
    ) as keyof ConfigurableCouncilData

    if (!(key in getProps(ConfigurableCouncilData))) {
      return msg.reply(
        response(
          ResponseType.Bad,
          `:x: \`${key}\` est pas une configuration valide.`
        )
      )
    }

    const serializer = ConfigurableCouncilDataSerializers[key]
    const display = makeDisplay(serializer.display)

    if (args.value.length === 0) {
      return msg.reply(
        response(
          ResponseType.Neutral,
          `La configuration ${args.key} est actuellement paramétré sur ~${display(
            this.council.getConfig(key)
          )}~.`
        )
      )
    }

    if (args.value === "$remove" && key in getProps(OptionalCouncilData)) {
      this.council.setConfig(key, getDefaultValue(key, OptionalCouncilData))
      return msg.reply(
        response(
          ResponseType.Neutral,
          `La configuration ~${key}~ est désormais mis sur la valeur par défaut.`
        )
      )
    }

    const value = await parseType(this.client, msg, args.value, serializer)

    if (value !== null) {
      const serializedValue = serializer.serialize(value)

      this.council.setConfig(key, serializedValue)

      return msg.reply(
        response(
          ResponseType.Good,
          `La configuration ~${key}~ est désormais ${display(value)}`
        )
      )
    } else {
      return msg.reply(
        response(
          ResponseType.Bad,
          `~${args.value}~ est un invalide **${serializer.type}**`
        )
      )
    }
  }
}
