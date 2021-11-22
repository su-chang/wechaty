import { FileBox } from 'file-box'

import {
  WechatyBuilder,
}                     from '../src/mods/mod.js'

const bot = WechatyBuilder.build({
  name : 'moment-bot',
})

async function testMoment () {
  const contact = await bot.Contact.find({ id: 'xxx' })
  const room = await bot.Room.find({ id: 'xxx' })

  if (!contact || !room) {
    return
  }

  const post = bot.Post.builder()
    .add('hello, world')
    .add(FileBox.fromQRCode('qr'))
    .add(await bot.UrlLink.create('https://wechaty.js.org'))
    .build()

  const moment = await bot.Moment.post(post)

  if (moment) {
    // replay to moment
    const commentPost = await moment.reply('hello world!')
    if (commentPost) {
      await commentPost.reply('welcome!')
    }

    // get comments of moment
    const [postList, nextPageToken] = await moment.childList({}, {
      pageSize: 10,
      pageToken: 'pageToken',
    })
    console.log(`postList: ${postList}, nextPageToken: ${nextPageToken}`)
  }

}

void testMoment()
