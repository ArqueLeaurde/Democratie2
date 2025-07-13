<p align="center">
  <a href="#"><img src="https://i.imgur.com/uF02JFi.png" alt="Demoscratos" /></a>
  <br>
  <a href="https://github.com/OGEC-Union-Lassalienne/Democratie2">Voir la source sur GitHub</a>
  <br><br>

# Démocratie3

Un bot Discord pour la gestion démocratique de motions et votes dans un salon dédié, adapté aux conseils restreints ou aux groupes souhaitant délibérer efficacement.

## Fonctionnalités principales
- Création et gestion de conseils et de motions
- Système de vote par commandes/réactions pondéré par rôles/utilisateurs
- Archivage et export des motions en JSON
- Configuration flexible des conseils et motions
  
## Commandes

### Commandes admin
These commands can only be run by someone with the `Manage Server` permission, or with a role named `Votum Admin`.

| Command         | Description |
| -------------   | ----------- |
| `!Council [name]` | Créé ou renomme un conseil dans le salon.
| `!Council remove` | Supprime le conseil du salon.
| `!CouncilStats` | Affiche quelques statistiques sur le conseil.
| `!SetWeight [user/role] [weight]` | Définis le poids du vote d'un rôle ou d'un utilisateur. Voir [Pondération des Votes](#pondération-des-votes)
| `!VoteWeights` | Affiche les poids des votes actuels. Voir [Pondération des Votes](#pondération-des-votes)
| `!config [key] [value]` | Configuration des paramètres du conseil. Voir la table ci-dessous
| `!config [key] $remove`  | Réinitialise le paramètre à sa valeur par défaut.

### Points de configuration

| Key | Value type | Description | Default |
| ------------- | ---------- | ----------- | ------- |
| `councilor.role` | `role` | Définit un role que les conseillers doivent avoir pour voter. Sinon, toute personne qui peut voir le salon pourra voter et sera compté pour la majorité. | None
| `propose.role` | `role` | Restreint la proposition de motions aux utilisateurs avec ce rôle seulement (en plus du rôle conseiller). | None
| `dictator.role` | `role` | A chaque fois qu'un utilisateur avec le rôle dictateur vote, la motion sera acceptée ou rejetée immédiatement selon son vote. | None
| `user.cooldown` | `number` | Définit le nombre d'heures qu'un conseiller doit attendre entre la proposition de plusieurs motions (les motion abandonnées ne comptent pas par défaut). | `0`
| `user.cooldown.kill` | `boolean` | Définit si les motions abandonnées déclenchent le compte à rebours ou non. | false
| `motion.expiration` | `number` | Définit le nombre d'heures qu'une motion peut rester active. | `0`
| `announce.channel` | `channel` | Désigne un salon ou toutes les motions (sauf abandonnées) seront affichées. | None
| `on.passed.announce` | `channel` | Un salon pour l'annonce des motions *approuvées* seulement. | None
| `on.killed.announce` | `channel` | Un salon pour l'annonce des motions *abandonnées* seulement. | None
| `on.failed.announce` | `channel` | Un salon pour l'annonce des motions *rejetées* seulement. | None
| `councilor.motion.disable` | `boolean` | Si la création de nouvelles motions est désactivée ou non dans ce conseil (n'accepte que les motions transmises). | false
| `motion.queue` | `boolean` | Si activé, une motion peut être créée quand une autre est active et sera placée en file d'attente, et automatiquement démarrée à la fin de la motion en cours. | false
| `majority.default` | `majority-type` | La majorité par défaut pour les motions. Fraction ou pourcentage. | 1/2
| `majority.minimum` | `majority-type` | La majorité minimum avec laquelle les conseillers peuvent créer une motion. | 1/2
| `majority.reached.ends` | `boolean` | Si une motion se termine aussitot que la majorité est atteinte, sinon tous les conseillers doivent voter. | true
| `on.finish.actions` | `json` | Un groupe d'actions qui prendront place à la fin d'une motion. See [Actions de fin de motion](#actions-de-fin-de-motion) | None
| `vote.weights` | `json` | Permet à différents rôles/utilisateurs d'avoir un poids plus ou moins important lors d'un vote . Voir [Pondération des Votes](#weighted-voting) | None
| `reason.required.yes` | `boolean` | Si l'utilisateur doit fournir une raison avec un vote positif. | true
| `reason.required.no` | `boolean` | Si l'utilisateur doit fournir une raison avec un vote négatif. | true
| `reason.required.abstain` | `boolean` | Si l'utilisateur doit fournir une raison avec un vote neutre/blanc. | false
| `create.deliberation.channels` | `boolean` | Si il faut créer un salon de délibération pour chaque motion ou pas. | false
| `keep.transcripts` | `boolean` | Si il faut conserver une transcription des salons de délibération avant qu'ils soient supprimés ou pas. | false

### Commandes des conseillers

| Command         | Description |
| -------------   | ----------- |
| `!motion` | Voir la motion en cours.
| `!motion <motion text>` | Créé une motion avec l'argument saisi ensuite.
| `!motion [options] <motion text>` | Créé une motion avec certaines options. Voir [Options des Motions](#options-des-motions)
| `!motion kill` | Abandonne la motion en cours. (ADMINS SEULEMENT).
| `!yes <reason>` | Vote "oui" pour la motion en cours.
| `!no <reason>` | Vote "non" pour la motion en cours.
| `!abstain [reason]` | Vote blanc pour la motion en cours.
| `!lazyvoters` | Mentionne tous les membres du conseil qui n'ont pas encore voté.
| `!archive [range]` | Permet de voir les motions passées. Spécifiez une plage de nombres pour voir un résumé, ou un seul nombre pour voir la motion en question.
| `!archive export` | Exporte les données du conseil au format d'un fichier JSON.

#### Options des Motions

Les options sont des indicateurs spéciaux que vous mettez au début de votre motion pour en changer la configuration. Pour l'instant les seules options disponibles sont pour changer le type de majorité.

| Option flag | Aliases | Type | Description |
| ----------- | ------- | ---- | ----------- |
| `majority`  | `m`     | `majority type` | Un pourcentage ou une fraction indiquant le type de majorité.
| `unanimous` | `u`     | `boolean` | Si une motion doit être unanime ou non (raccourci pour `-m 100%`).

##### Exemples

Pour lancer une motion avec une majorité 2/3, vous pouvez utiliser les commandes (équivalentes):<br>
- `!motion -m 2/3 Motion text goes here`
- `!motion --majority 2/3 Motion text goes here`
- `!motion --majority 66% Motion text goes here`

Motions unanimes (équivalentes):<br>
- `!motion -u Motion text goes here`
- `!motion --unanimous Motion text goes here`
- `!motion -m 100% Motion text goes here`
- `!motion -m 1/1 Motion text goes here`


## Voter

- Plusieurs conseils peuvent être définis sur un même serveur Discord car ils sont basés sur les salons textuels.
- En cas de match nul, la motion restera active jusqu'à ce que que quelqu'un brise l'égalité.
- Le temps avant qu'un conseiller puisse proposer une motion n'est pas déclenché si la motion est abandonnée.
- Quand une motion expire, l'issue est déterminée par la majorité des votes. S'il y a plus de "oui" que de "non", elle sera approuvée et vice-versa.
- Si vous ne définissez pas de rôle Conseiller, le nombre total de votants sera déterminé par qui peut voir le salon. Il est recommadné de créer un rôle afin d'être certain que seuls les possibles votants comptent pour la majorité.
- Les admins (ou personnes avec un rôle appelé `Democratie Admin`) peuvent créer des motions sans restrictions.

## Rapide mise en place

1. Choisissez un salon dans lequel les conseillers vont délibérer.
2. Lancez `!Council My Council` pour marquer ce salon en tant que conseil. (Changez "My Council" pour n'importe quel nom pour votre conseil)
3. Créez un rôle pour les membres de votre conseil. Après quoi, lancez `!config councilor.role RoleNameHere`.
4. Lancez `!motion This is my first motion`. Et voilà c'est fait! Vous pouvez consulter les options de configuration ci-dessus pour une utilisation plus avancée.

## Actions de fin de motion

Avec le point de configuration `on.finish.actions` , vous pouvez fournir un JSON personnalisé qui dira à Démocratie quoi faire une fois que votre motion est terminée proporement. Evidemment, vous pouvez transmettre votre motion au seil d'autres conseils (en fonction du type de majorité) avec potentiellement différentes options. Utilisez [ce lien](https://json-editor.github.io/json-editor/?data=N4Ig9gDgLglmB2BnEAuUMDGCA2MBGqIAZglAIYDuApomALZUCsIANOHgFZUZQD62ZAJ5gArlELwwAJzplsrEIgwALKrNSgAJlSIx4MWAmRoQZHnHgaQUQRCqEyUqUIWwo2eyhABBcwgUGasagNnaEYJzc4mxuHoS+hpZsUlQAjiIwKZqoANqmfknWYCAAumxkmpoGFnIAClKQVFKwNKhEcohUbBANds0wrSZkUACyZBzSBoJWoZ4g8CJ0eE2uBnFe3lAABFDKMIhbshNSU15s2u0i2OIoAAxsdHowdIuo9yCyAB7PrygAjGwqJ8yHQIB5jDlbgA6RglAC+5QKM1sc0QUBO8AA5qt3HMEhYFBcyFcbiAFECQWDBnkSFIKI5smUQFQFnRcsRpPSpIyEUVkWEvGiMdiYms5gBhUTwDAwbBbACSABFCTpiddCOTgaDwezbnqAEwAZiNtyNJuNhr1pW6wygTUsXgAegAKSEAWgAnCUANQASgAJCBeZBEsFrCjCEK9CLrGLCAB5aAWA5RrEqpQnJP+LyJ0NbVOYrYUPYqLZgABuTRO2gOuyoWyB+1gWMOYESZazSE1lJ1KDybrdR0mNi2+oA9IbSnDp9O2P6lKp1F5lFAoBAUGOxxxaPA3Qu1GQodJMWPNM4iFA3bcAOxj/eyADErgjXgiXB4OPWIAAam3FlsRjbCwtnxIwFAqKpEjqXomhaYx2mwTpyngQR4yIXJQBSdJMiobI+xACAyEQToeRYTC0gyLJ2XaWVcKnMiQCwyi6PwgBrWUPB5JkekafpBlAQjiJY0B/RSdCvAfU8dCeUMxzMRJPzmWoiJIoM2BozirFEnRCEki4ZOTOSkVFXFCAAMTIWjsl5djsE0kxtPEkA9Ok/RZPkgkTK/ABpDi6JnNhEGUMAKF4KtpGMEA9DtZxjOsRc5jwMA2yFMgIAAFiDOEgA==) pour accéder à un formulaire où vous pourrez générer une configuration JSON valide pour cette option. Ces actions ont les champs suivants:

| field | type | description |
| ----- | ---- | ----------- |
| action | string enum (forward) | L'action. Seul `forward` (transmettre) est supporté.
| to    | snowflake | L'ID Discord du salon avec le nouveau conseil.
| atMajority? | number | Un nombre entre 0-1 qui empêchera l'action de s'effectuer à moins que la motion soit résolue avec la majorité donnée. (facultatif)
| options? | string | [Options des Motions](#options-des-motions)

## Pondération des Votes

Avec le point de configuration `vote.weights`,
vous pouvez fournir un fichier map JSON entre les identifiants d'Utilisateurs et de Rôles avec le nombre de poids du vote qu'il leur est accordé. Si un conseiller a plus d'un de ces rôles, les votes seront additionnés.
Le JSON fourni doit être un objet qui à à des identifiants clés sous forme de chaines de caractères mappées à des valeurs numériques. Par exemple, ceci est un mapping valide:

```json
{
  "113691352327389188": 5,
  "400057282752151565": 2,
  "601529861244321793": 4,
  "401864080446717952": 8
}
```

Pour savoir comment obtenir les identifiants de rôles/utilisateurs, vous pouvez consulter [cet article d'aide](https://support.discordapp.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-).
