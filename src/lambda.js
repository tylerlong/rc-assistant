import serverlessHTTP from 'serverless-http'
import { createAsyncProxy } from 'ringcentral-chatbot/dist/lambda'
import axios from 'axios'

import app from './app'

module.exports.app = serverlessHTTP(app)

module.exports.proxy = createAsyncProxy('app')

module.exports.maintain = async () => {
  await axios.put(`${process.env.RINGCENTRAL_CHATBOT_SERVER}/admin/maintain`, undefined, { auth: {
    username: process.env.RINGCENTRAL_CHATBOT_ADMIN_USERNAME,
    password: process.env.RINGCENTRAL_CHATBOT_ADMIN_PASSWORD
  } })
  await axios.put(`${process.env.RINGCENTRAL_CHATBOT_SERVER}/ringcentral/refresh-tokens`)
}
