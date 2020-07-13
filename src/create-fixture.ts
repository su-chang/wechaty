/* eslint-disable sort-keys */
import {
  PuppetMock,
  mock,
}                       from 'wechaty-puppet-mock'

import { Wechaty } from './wechaty'
import { Message } from './user/message'

interface Fixture {
  wechaty : Wechaty,
  mocker  : mock.Mocker,

  moList: Message[],
  mtList: Message[],

  bot     : mock.ContactMock,
  player  : mock.ContactMock,
  message : Message,

  room: mock.RoomMock,
}

async function * createFixture (): AsyncGenerator<Fixture> {
  const mocker = new mock.Mocker()
  const puppet = new PuppetMock({ mocker })
  const wechaty = new Wechaty({ puppet })

  await wechaty.start()

  const bot    = mocker.createContact({ name: 'Bot' })
  const player = mocker.createContact({ name: 'Player' })
  mocker.login(bot)

  const room = mocker.createRoom({
    memberIdList: [
      bot.id,
      player.id,
    ],
  })

  const messageFuture = new Promise<Message>(resolve => wechaty.once('message', resolve))
  player.say().to(bot)
  const message = await messageFuture

  // Mobile Terminated
  const mtList = [] as Message[]
  const recordMobileTerminatedMessage = (message: Message) => {
    if (!message.self()) {
      mtList.push(message)
    }
  }
  wechaty.on('message', recordMobileTerminatedMessage)

  // Mobile Originated
  const moList = [] as Message[]
  const recordMobileOriginatedMessage = (message: Message) => {
    if (message.self()) {
      moList.push(message)
    }
  }
  wechaty.on('message', recordMobileOriginatedMessage)

  yield {
    wechaty,
    mocker,

    bot,
    player,
    message,
    room,

    moList,
    mtList,
  }

  await wechaty.stop()
}

export { createFixture }
