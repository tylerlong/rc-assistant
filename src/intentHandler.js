import * as R from 'ramda'

import rc from './ringcentral'
import { formatObj, sendAuthorizationLink } from './util'

export const handleIntent = async (intent, event, service) => {
  console.log(JSON.stringify(intent, null, 2))
  const { bot, group } = event
  if (intent.dialogState === 'ElicitSlot' || intent.dialogState === 'ElicitIntent' || intent.dialogState === 'Failed') {
    return bot.sendMessage(group.id, { text: intent.message.replace(/\\n/g, '\n') })
  }

  if (intent.dialogState !== 'ReadyForFulfillment') {
    throw new Error(`unexpected intent dialogState: ${intent.dialogState}`)
  }

  switch (intent.intentName) {
    case 'Hello':
      return handleHello(intent, event)
    case 'Help':
      return handleHelp(intent, event)
    default:
      break
  }

  // before are services which don't need rc token
  // after are services which do need rc token

  if (!service) {
    return sendAuthorizationLink(group, bot)
  }

  try {
    switch (intent.intentName) {
      case 'CompanyInfo':
        await handleCompanyInfo(intent, event, service)
        break
      case 'PresenceInfo':
        await handlePresenceInfo(intent, event, service)
        break
      default:
        throw new Error(`Unhandled intent: ${intent.intentName}`)
    }
  } catch (e) {
    if (e.data && /\btoken\b/i.test(e.data.message)) { // refresh token invalid
      await bot.sendMessage(group.id, { text: `I had been authorized to access RingCentral account, however it is expired/revoked.` })
      await sendAuthorizationLink(group, bot)
      await service.destroy()
    }
    throw e
  }
}

const handleHello = async (intent, event) => {
  const { bot, group, userId } = event
  let helloMessage = `
Hello ![:Person](${userId}), I am ![:Person](${bot.id}). I can help you with the following:
* **View your company information** like billing plan, service plane, business hours etc.
* **View/edit your personal information** like personal information, business hours, services available etc.
* **View/edit your notification settings** for Voicemails, Texts and Fax
* **View your presence information and Edit Do Not Disturb and User Status**
* **View/edit your caller ID settings** for available features
If you would like see more detailed information about any of the functions above, please ask.
`.trim()
  await bot.sendMessage(group.id, { text: helloMessage })
}

const handleHelp = async (intent, event) => {
  let text = ''
  switch (intent.slots.FeatureGroup) {
    case 'company info':
      text = `
Here is a list of features available for **company information**:
* **View company details** - company id, name, main number and operator extension
* **View company billing plan** - billing id, name, duration unit, duration, type and included phone lines
* **View company service plan** - service ID, name and service edition
* **View company business hours** - operation hours for the entire week
* **View company greeting language** - greeting language, name and local code
* **View company time-zone** - time-zone ID, name, description and bias
`
      break
    case 'personal info':
      text = `
Here is a list of features available for **personal info**:
* **View your personal information** - First and Last Name, Company, Business Phone and Business Hours
* **View business hours** - your business hours for the entire week
* **Edit my business hours**
* **Services available to you** - lists all the RingCentral services that available for you to use
* **Services unavailable to me** - lists all the RingCentral services that are not available for you
* **Edit your personal information** - you can edit your First and Last Name, Business Phone, Business Hourss and Address
`
      break
    case 'notification settings':
      text = `
Here is a list of features available for **notification settings**:
* **View notifications settings** for voicemails, missed calls, fax and texts
* **Enable/Disable email or sms notifications** for voicemails, missed calls, fax and texts
`
      break
    case 'presence info':
      text = `
Here is a list of features available for **presence info**:
* **View your presence info** - lists your Presence, Telephony, User and Do Not Disturb status
* **Change your Do Not Disturb status ** to take all calls or to not accept any calls
* **Set your user status** to Available, Busy or Offline
`
      break
    case 'caller ID info':
      text = `
Here is a list of features available for **Caller ID settings**:
* **View your caller ID settings** for available features
* **Edit caller ID settings**
`
      break
    default:
      break
  }
  const { bot, group } = event
  await bot.sendMessage(group.id, { text: text.trim() })
}

const handleCompanyInfo = async (intent, event, service) => {
  rc.token(service.data.token)
  const r = await rc.get('/restapi/v1.0/account/~')
  const obj = {
    company_id: r.data['serviceInfo']['brand']['id'],
    brand_name: r.data['serviceInfo']['brand']['name'],
    main_number: r.data['mainNumber'],
    operator_extension: r.data['operator']['extensionNumber'],
    home_country: r.data['serviceInfo']['brand']['homeCountry']['name']
  }
  const { bot, group } = event
  await bot.sendMessage(group.id, { text: formatObj(obj) })
}

const handlePresenceInfo = async (intent, event, service) => {
  rc.token(service.data.token)
  const r = await rc.get('/restapi/v1.0/account/~/extension/~/presence', {
    params: {
      detailedTelephonyState: true,
      sipData: false
    }
  })
  const dl = formatObj(R.pick([
    'presenceStatus',
    'telephonyStatus',
    'userStatus',
    'dndStatus',
    'ringOnMonitoredCall',
    'pickUpCallsOnHold'
  ], r.data))
  const { bot, group } = event
  await bot.sendMessage(group.id, { text: dl })
}