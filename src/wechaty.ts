/**
 *   Wechaty Chatbot SDK - https://github.com/wechaty/wechaty
 *
 *   @copyright 2016 Huan LI (李卓桓) <https://github.com/huan>, and
 *                   Wechaty Contributors <https://github.com/wechaty>.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */
import cuid             from 'cuid'
import { EventEmitter } from 'events'
import os               from 'os'

import TypedEventEmitter  from 'typed-emitter'
import { cloneClass }     from 'clone-class'
import { StateSwitch }    from 'state-switch'

import {
  CHAT_EVENT_DICT,
  Puppet,

  MemoryCard,

  PUPPET_EVENT_DICT,
  PuppetEventName,
  PuppetOptions,
  ScanStatus,
}                       from 'wechaty-puppet'

import {
  FileBox,
  Raven,

  config,
  log,
}                       from './config'

import {
  VERSION,
  GIT_COMMIT_HASH,
}                       from './version'

import {
  Sayable,
}                       from './types'

import {
  Io,
}                       from './io'
import {
  PuppetModuleName,
}                       from './puppet-config'
import {
  PuppetManager,
}                       from './puppet-manager'

import {
  Contact,
  Tag,
  ContactSelf,
  Friendship,
  Message,
  Image,
  Room,
  RoomInvitation,
  UrlLink,
  MiniProgram,
}                       from './user/mod'

import { timestampToDate } from './helper-functions/pure/timestamp-to-date'

export const WECHATY_EVENT_DICT = {
  ...CHAT_EVENT_DICT,
  dong      : 'Should be emitted after we call `Wechaty.ding()`',
  error     : "Will be emitted when there's an Error occurred.",
  heartbeat : 'Will be emitted periodically after the Wechaty started. If not, means that the Wechaty had died.',
  ready     : 'All underlined data source are ready for use.',
  start     : 'Will be emitted after the Wechaty had been started.',
  stop      : 'Will be emitted after the Wechaty had been stopped.',
}

export type WechatyEventName  = keyof typeof WECHATY_EVENT_DICT

/**
 * Wechaty Event Listener Interfaces
 */
export type WechatyDongEventListener       = (this: Wechaty, data?: string) => void
export type WechatyErrorEventListener      = (this: Wechaty, error: Error) => void
export type WechatyFriendshipEventListener = (this: Wechaty, friendship: Friendship) => void
export type WechatyHeartbeatEventListener  = (this: Wechaty, data: any) => void
export type WechatyLoginEventListener      = (this: Wechaty, user: ContactSelf) => void
export type WechatyLogoutEventListener     = (this: Wechaty, user: ContactSelf, reason?: string) => void
export type WechatyMessageEventListener    = (this: Wechaty, message: Message) => void
export type WechatyReadyEventListener      = (this: Wechaty) => void
export type WechatyRoomInviteEventListener = (this: Wechaty, roomInvitation: RoomInvitation) => void
export type WechatyRoomJoinEventListener   = (this: Wechaty, room: Room, inviteeList: Contact[], inviter: Contact,  date?: Date) => void
export type WechatyRoomLeaveEventListener  = (this: Wechaty, room: Room, leaverList: Contact[],  remover?: Contact, date?: Date) => void
export type WechatyRoomTopicEventListener  = (this: Wechaty, room: Room, newTopic: string, oldTopic: string, changer: Contact, date?: Date) => void
export type WechatyScanEventListener       = (this: Wechaty, qrcode: string, status: ScanStatus, data?: string) => void
export type WechatyStartStopEventListener  = (this: Wechaty) => void

/**
 * @desc       Wechaty Class Event Type
 * @typedef    WechatyEventName
 * @property   {string}  error       - When the bot get error, there will be a Wechaty error event fired.
 * @property   {string}  login       - After the bot login full successful, the event login will be emitted, with a Contact of current logged in user.
 * @property   {string}  logout      - Logout will be emitted when bot detected log out, with a Contact of the current login user.
 * @property   {string}  heartbeat   - Get heartbeat of the bot.
 * @property   {string}  friendship  - When someone sends you a friend request, there will be a Wechaty friendship event fired.
 * @property   {string}  message     - Emit when there's a new message.
 * @property   {string}  ready       - Emit when all data has load completed, in wechaty-puppet-padchat, it means it has sync Contact and Room completed
 * @property   {string}  room-join   - Emit when anyone join any room.
 * @property   {string}  room-topic  - Get topic event, emitted when someone change room topic.
 * @property   {string}  room-leave  - Emit when anyone leave the room.<br>
 *                                   - If someone leaves the room by themselves, WeChat will not notice other people in the room, so the bot will never get the "leave" event.
 * @property   {string}  room-invite - Emit when there is a room invitation, see more in  {@link RoomInvitation}
 * @property   {string}  scan        - A scan event will be emitted when the bot needs to show you a QR Code for scanning. </br>
 *                                    It is recommend to install qrcode-terminal(run `npm install qrcode-terminal`) in order to show qrcode in the terminal.
 */

/**
 * @desc       Wechaty Class Event Function
 * @typedef    WechatyEventFunction
 * @property   {Function} error           -(this: Wechaty, error: Error) => void callback function
 * @property   {Function} login           -(this: Wechaty, user: ContactSelf)=> void
 * @property   {Function} logout          -(this: Wechaty, user: ContactSelf) => void
 * @property   {Function} scan            -(this: Wechaty, url: string, code: number) => void <br>
 * <ol>
 * <li>URL: {String} the QR code image URL</li>
 * <li>code: {Number} the scan status code. some known status of the code list here is:</li>
 * </ol>
 * <ul>
 * <li>0 initial_</li>
 * <li>200 login confirmed</li>
 * <li>201 scanned, wait for confirm</li>
 * <li>408 waits for scan</li>
 * </ul>
 * @property   {Function} heartbeat       -(this: Wechaty, data: any) => void
 * @property   {Function} friendship      -(this: Wechaty, friendship: Friendship) => void
 * @property   {Function} message         -(this: Wechaty, message: Message) => void
 * @property   {Function} ready           -(this: Wechaty) => void
 * @property   {Function} room-join       -(this: Wechaty, room: Room, inviteeList: Contact[],  inviter: Contact) => void
 * @property   {Function} room-topic      -(this: Wechaty, room: Room, newTopic: string, oldTopic: string, changer: Contact) => void
 * @property   {Function} room-leave      -(this: Wechaty, room: Room, leaverList: Contact[]) => void
 * @property   {Function} room-invite     -(this: Wechaty, room: Room, roomInvitation: RoomInvitation) => void <br>
 *                                        see more in  {@link RoomInvitation}
 */

/**
 * @listens Wechaty
 * @param   {WechatyEventName}      event      - Emit WechatyEvent
 * @param   {WechatyEventFunction}  listener   - Depends on the WechatyEvent
 *
 * @return  {Wechaty}                          - this for chaining,
 * see advanced {@link https://github.com/wechaty/wechaty-getting-started/wiki/FAQ-EN#36-why-wechatyonevent-listener-return-wechaty|chaining usage}
 *
 * @desc
 * When the bot get message, it will emit the following Event.
 *
 * You can do anything you want when in these events functions.
 * The main Event name as follows:
 * - **scan**: Emit when the bot needs to show you a QR Code for scanning. After scan the qrcode, you can login
 * - **login**: Emit when bot login full successful.
 * - **logout**: Emit when bot detected log out.
 * - **message**: Emit when there's a new message.
 *
 * see more in {@link WechatyEventName}
 *
 * @example <caption>Event:scan</caption>
 * // Scan Event will emit when the bot needs to show you a QR Code for scanning
 *
 * bot.on('scan', (url, status) => {
 *   console.log(`[${status}] Scan ${url} to login.` )
 * })
 *
 * @example <caption>Event:login </caption>
 * // Login Event will emit when bot login full successful.
 *
 * bot.on('login', (user) => {
 *   console.log(`user ${user} login`)
 * })
 *
 * @example <caption>Event:logout </caption>
 * // Logout Event will emit when bot detected log out.
 *
 * bot.on('logout', (user) => {
 *   console.log(`user ${user} logout`)
 * })
 *
 * @example <caption>Event:message </caption>
 * // Message Event will emit when there's a new message.
 *
 * wechaty.on('message', (message) => {
 *   console.log(`message ${message} received`)
 * })
 *
 * @example <caption>Event:friendship </caption>
 * // Friendship Event will emit when got a new friend request, or friendship is confirmed.
 *
 * bot.on('friendship', (friendship) => {
 *   if(friendship.type() === Friendship.Type.Receive){ // 1. receive new friendship request from new contact
 *     const contact = friendship.contact()
 *     let result = await friendship.accept()
 *       if(result){
 *         console.log(`Request from ${contact.name()} is accept successfully!`)
 *       } else{
 *         console.log(`Request from ${contact.name()} failed to accept!`)
 *       }
 *  } else if (friendship.type() === Friendship.Type.Confirm) { // 2. confirm friendship
 *       console.log(`new friendship confirmed with ${contact.name()}`)
 *    }
 *  })
 *
 * @example <caption>Event:room-join </caption>
 * // room-join Event will emit when someone join the room.
 *
 * bot.on('room-join', (room, inviteeList, inviter) => {
 *   const nameList = inviteeList.map(c => c.name()).join(',')
 *   console.log(`Room ${room.topic()} got new member ${nameList}, invited by ${inviter}`)
 * })
 *
 * @example <caption>Event:room-leave </caption>
 * // room-leave Event will emit when someone leave the room.
 *
 * bot.on('room-leave', (room, leaverList) => {
 *   const nameList = leaverList.map(c => c.name()).join(',')
 *   console.log(`Room ${room.topic()} lost member ${nameList}`)
 * })
 *
 * @example <caption>Event:room-topic </caption>
 * // room-topic Event will emit when someone change the room's topic.
 *
 * bot.on('room-topic', (room, topic, oldTopic, changer) => {
 *   console.log(`Room ${room.topic()} topic changed from ${oldTopic} to ${topic} by ${changer.name()}`)
 * })
 *
 * @example <caption>Event:room-invite, RoomInvitation has been encapsulated as a RoomInvitation Class. </caption>
 * // room-invite Event will emit when there's an room invitation.
 *
 * bot.on('room-invite', async roomInvitation => {
 *   try {
 *     console.log(`received room-invite event.`)
 *     await roomInvitation.accept()
 *   } catch (e) {
 *     console.error(e)
 *   }
 * }
 *
 * @example <caption>Event:error </caption>
 * // error Event will emit when there's an error occurred.
 *
 * bot.on('error', (error) => {
 *   console.error(error)
 * })
 */
interface Events {
  dong          : WechatyDongEventListener
  error         : WechatyErrorEventListener
  friendship    : WechatyFriendshipEventListener
  heartbeat     : WechatyHeartbeatEventListener
  login         : WechatyLoginEventListener
  logout        : WechatyLogoutEventListener
  message       : WechatyMessageEventListener
  ready         : WechatyReadyEventListener
  'room-invite' : WechatyRoomInviteEventListener
  'room-join'   : WechatyRoomJoinEventListener
  'room-leave'  : WechatyRoomLeaveEventListener
  'room-topic'  : WechatyRoomTopicEventListener
  scan          : WechatyScanEventListener
  start         : WechatyStartStopEventListener
  stop          : WechatyStartStopEventListener
}

const WechatyEventEmitter = EventEmitter as new () => TypedEventEmitter<
  Events
>

export interface WechatyOptions {
  memory?        : MemoryCard,
  name?          : string,                    // Wechaty Name

  // @deprecated: use `name` instead of `profile`
  profile?       : null | string,             // DEPRECATED: use name instead

  puppet?        : PuppetModuleName | Puppet, // Puppet name or instance
  puppetOptions? : PuppetOptions,             // Puppet TOKEN
  ioToken?       : string,                    // Io TOKEN
}

type WechatyPluginUninstaller = () => void
export interface WechatyPlugin {
  (bot: Wechaty): void | WechatyPluginUninstaller
}

const PUPPET_MEMORY_NAME = 'puppet'

/**
 * Main bot class.
 *
 * A `Bot` is a WeChat client depends on which puppet you use.
 * It may equals
 * - web-WeChat, when you use: [puppet-puppeteer](https://github.com/wechaty/wechaty-puppet-puppeteer)/[puppet-wechat4u](https://github.com/wechaty/wechaty-puppet-wechat4u)
 * - ipad-WeChat, when you use: [puppet-padchat](https://github.com/wechaty/wechaty-puppet-padchat)
 * - ios-WeChat, when you use: puppet-ioscat
 *
 * See more:
 * - [What is a Puppet in Wechaty](https://github.com/wechaty/wechaty-getting-started/wiki/FAQ-EN#31-what-is-a-puppet-in-wechaty)
 *
 * > If you want to know how to send message, see [Message](#Message) <br>
 * > If you want to know how to get contact, see [Contact](#Contact)
 *
 * @example <caption>The World's Shortest ChatBot Code: 6 lines of JavaScript</caption>
 * const { Wechaty } = require('wechaty')
 * const bot = new Wechaty()
 * bot.on('scan',    (qrCode, status) => console.log('https://wechaty.github.io/qrcode/' + encodeURIComponent(qrcode)))
 * bot.on('login',   user => console.log(`User ${user} logged in`))
 * bot.on('message', message => console.log(`Message: ${message}`))
 * bot.start()
 */
export class Wechaty extends WechatyEventEmitter implements Sayable {

  public static readonly VERSION = VERSION

  public  readonly state      : StateSwitch
  private readonly readyState : StateSwitch
  public  readonly wechaty    : Wechaty

  /**
   * singleton globalInstance
   * @ignore
   */
  private static globalInstance: Wechaty

  private static globalPluginList: WechatyPlugin[] = []

  private memory?: MemoryCard

  private lifeTimer? : NodeJS.Timer
  private io?        : Io

  public puppet!: Puppet

  /**
   * the cuid
   * @ignore
   */
  public readonly id : string

  public readonly Contact       : typeof Contact
  public readonly Tag           : typeof Tag
  public readonly ContactSelf   : typeof ContactSelf
  public readonly Friendship    : typeof Friendship
  public readonly Message       : typeof Message
  public readonly Image         : typeof Image
  public readonly RoomInvitation: typeof RoomInvitation
  public readonly Room          : typeof Room
  public readonly UrlLink       : typeof UrlLink
  public readonly MiniProgram   : typeof MiniProgram

  /**
   * Get the global instance of Wechaty
   *
   * @param {WechatyOptions} [options={}]
   *
   * @example <caption>The World's Shortest ChatBot Code: 6 lines of JavaScript</caption>
   * const { Wechaty } = require('wechaty')
   *
   * Wechaty.instance() // Global instance
   * .on('scan', (url, status) => console.log(`Scan QR Code to login: ${status}\n${url}`))
   * .on('login',       user => console.log(`User ${user} logged in`))
   * .on('message',  message => console.log(`Message: ${message}`))
   * .start()
   */
  public static instance (
    options?: WechatyOptions,
  ) {
    if (options && this.globalInstance) {
      throw new Error('instance can be only initialized once by options!')
    }
    if (!this.globalInstance) {
      this.globalInstance = new Wechaty(options)
    }
    return this.globalInstance
  }

  /**
   * @param   {WechatyPlugin[]} plugins      - The plugins you want to use
   *
   * @return  {Wechaty}                      - this for chaining,
   *
   * @desc
   * For wechaty ecosystem, allow user to define a 3rd party plugin for the all wechaty instances
   *
   * @example
   * // Report all chat message to my server.
   *
   * function WechatyReportPlugin(options: { url: string }) {
   *   return function (this: Wechaty) {
   *     this.on('message', message => http.post(options.url, { data: message }))
   *   }
   * }
   *
   * bot.use(WechatyReportPlugin({ url: 'http://somewhere.to.report.your.data.com' })
   */
  public static use (
    ...plugins:  (WechatyPlugin | WechatyPlugin[])[]
  ) {
    const pluginList = plugins.flat()
    this.globalPluginList = this.globalPluginList.concat(pluginList)
  }

  /**
   * The term [Puppet](https://github.com/wechaty/wechaty/wiki/Puppet) in Wechaty is an Abstract Class for implementing protocol plugins.
   * The plugins are the component that helps Wechaty to control the WeChat(that's the reason we call it puppet).
   * The plugins are named XXXPuppet, for example:
   * - [PuppetPuppeteer](https://github.com/wechaty/wechaty-puppet-puppeteer):
   * - [PuppetPadchat](https://github.com/wechaty/wechaty-puppet-padchat)
   *
   * @typedef    PuppetModuleName
   * @property   {string}  PUPPET_DEFAULT
   * The default puppet.
   * @property   {string}  wechaty-puppet-wechat4u
   * The default puppet, using the [wechat4u](https://github.com/nodeWechat/wechat4u) to control the [WeChat Web API](https://wx.qq.com/) via a chrome browser.
   * @property   {string}  wechaty-puppet-padchat
   * - Using the WebSocket protocol to connect with a Protocol Server for controlling the iPad WeChat program.
   * @property   {string}  wechaty-puppet-puppeteer
   * - Using the [google puppeteer](https://github.com/GoogleChrome/puppeteer) to control the [WeChat Web API](https://wx.qq.com/) via a chrome browser.
   * @property   {string}  wechaty-puppet-mock
   * - Using the mock data to mock wechat operation, just for test.
   */

  /**
   * The option parameter to create a wechaty instance
   *
   * @typedef    WechatyOptions
   * @property   {string}                 name            -Wechaty Name. </br>
   *          When you set this: </br>
   *          `new Wechaty({name: 'wechaty-name'}) ` </br>
   *          it will generate a file called `wechaty-name.memory-card.json`. </br>
   *          This file stores the login information for bot. </br>
   *          If the file is valid, the bot can auto login so you don't need to scan the qrCode to login again. </br>
   *          Also, you can set the environment variable for `WECHATY_NAME` to set this value when you start. </br>
   *          eg:  `WECHATY_NAME="your-cute-bot-name" node bot.js`
   * @property   {PuppetModuleName | Puppet}    puppet             -Puppet name or instance
   * @property   {Partial<PuppetOptions>} puppetOptions      -Puppet TOKEN
   * @property   {string}                 ioToken            -Io TOKEN
   */

  /**
   * Creates an instance of Wechaty.
   * @param {WechatyOptions} [options={}]
   *
   */
  constructor (
    private options: WechatyOptions = {},
  ) {
    super()
    log.verbose('Wechaty', 'constructor()')

    if (!options.name && options.profile) {
      log.verbose('Wechaty', 'constructor() WechatyOptions.profile DEPRECATED. use WechatyOptions.name instead.')
      options.name = options.profile
    }
    this.memory = this.options.memory

    this.id = cuid()

    this.state      = new StateSwitch('Wechaty', { log })
    this.readyState = new StateSwitch('WechatyReady', { log })

    this.wechaty = this

    /**
      * @ignore
     * Clone Classes for this bot and attach the `puppet` to the Class
     *
     *   https://stackoverflow.com/questions/36886082/abstract-constructor-type-in-typescript
     *   https://github.com/Microsoft/TypeScript/issues/5843#issuecomment-290972055
     *   https://github.com/Microsoft/TypeScript/issues/19197
     */
    // TODO: make Message & Room constructor private???
    this.Contact        = cloneClass(Contact)
    this.ContactSelf    = cloneClass(ContactSelf)
    this.Friendship     = cloneClass(Friendship)
    this.Image          = cloneClass(Image)
    this.Message        = cloneClass(Message)
    this.Room           = cloneClass(Room)
    this.RoomInvitation = cloneClass(RoomInvitation)
    this.Tag            = cloneClass(Tag)

    // No need to set puppet/wechaty, so do not clone
    this.UrlLink        = UrlLink
    this.MiniProgram    = MiniProgram

    this.installGlobalPlugin()
  }

  /**
   * @ignore
   */
  public toString () {
    if (!this.options) {
      return this.constructor.name
    }

    return [
      'Wechaty#',
      this.id,
      `<${(this.options && this.options.puppet) || ''}>`,
      `(${(this.memory && this.memory.name) || ''})`,
    ].join('')
  }

  /**
   * Wechaty bot name set by `options.name`
   * default: `wechaty`
   */
  public name () {
    return this.options.name || 'wechaty'
  }

  // public emit (event: 'dong',         data?: string)                                                                : boolean
  // public emit (event: 'error',        error: Error)                                                                 : boolean
  // public emit (event: 'friendship',   friendship: Friendship)                                                       : boolean
  // public emit (event: 'heartbeat',    data: any)                                                                    : boolean
  // public emit (event: 'login',        user: ContactSelf)                                                            : boolean
  // public emit (event: 'logout',       user: ContactSelf, reason?: string)                                           : boolean
  // public emit (event: 'message',      message: Message)                                                             : boolean
  // public emit (event: 'ready')                                                                                      : boolean
  // public emit (event: 'room-invite',  roomInvitation: RoomInvitation)                                               : boolean
  // public emit (event: 'room-join',    room: Room, inviteeList : Contact[], inviter : Contact, date: Date)           : boolean
  // public emit (event: 'room-leave',   room: Room, leaverList  : Contact[], remover : Contact, date: Date)           : boolean
  // public emit (event: 'room-topic',   room: Room, newTopic: string, oldTopic: string, changer: Contact, date: Date) : boolean
  // public emit (event: 'scan',         qrcode: string, status: ScanStatus, data?: string)                            : boolean
  // public emit (event: 'start' | 'stop')                                                                             : boolean

  // // guard for the above event: make sure it includes all the possible values
  // public emit (event: never, listener: never): never

  // public emit (
  //   event:   WechatyEventName,
  //   ...args: any[]
  // ): boolean {
  //   return super.emit(event, ...args)
  // }

  // public on (event: 'dong',           listener: WechatyDongEventListener)       : this
  // public on (event: 'error',          listener: WechatyErrorEventListener)      : this
  // public on (event: 'friendship',     listener: WechatyFriendshipEventListener) : this
  // public on (event: 'heartbeat',      listener: WechatyHeartbeatEventListener)  : this
  // public on (event: 'login',          listener: WechatyLoginEventListener)      : this
  // public on (event: 'logout',         listener: WechatyLogoutEventListener)     : this
  // public on (event: 'message',        listener: WechatyMessageEventListener)    : this
  // public on (event: 'ready',          listener: WechatyReadyEventListener)      : this
  // public on (event: 'room-invite',    listener: WechatyRoomInviteEventListener) : this
  // public on (event: 'room-join',      listener: WechatyRoomJoinEventListener)   : this
  // public on (event: 'room-leave',     listener: WechatyRoomLeaveEventListener)  : this
  // public on (event: 'room-topic',     listener: WechatyRoomTopicEventListener)  : this
  // public on (event: 'scan',           listener: WechatyScanEventListener)       : this
  // public on (event: 'start' | 'stop', listener: WechatyStartStopEventListener)  : this

  // // guard for the above event: make sure it includes all the possible values
  // public on (event: never, listener: never): never

  public on (event: WechatyEventName, listener: (...args: any[]) => any): this {
    log.verbose('Wechaty', 'on(%s, listener) registering... listenerCount: %s',
      event,
      this.listenerCount(event),
    )

    return super.on(event, listener)

    // const handleError = (e: Error, type = '') => {
    //   log.error('Wechaty', 'addListenerFunction(%s) listener %s exception: %s', event, type, e)
    //   this.emit('error', e)
    // }

    // /**
    //  * We use `super.on()` at here to prevent loop
    //  */
    // super.on(event, (...args: any[]) => {
    //   try {
    //     const result = listener.apply(this, args)
    //     if (result && result.catch && typeof result.catch === 'function') {
    //       result.catch((e: Error) => handleError(e, 'async'))
    //     }
    //   } catch (e) {
    //     handleError(e)
    //   }
    // })
    // return this
  }

  /**
   * @param   {WechatyPlugin[]} plugins      - The plugins you want to use
   *
   * @return  {Wechaty}                      - this for chaining,
   *
   * @desc
   * For wechaty ecosystem, allow user to define a 3rd party plugin for the current wechaty instance.
   *
   * @example
   * // The same usage with Wechaty.use().
   *
   */
  public use (...plugins: (WechatyPlugin | WechatyPlugin[])[]) {
    const pluginList = plugins.flat()
    pluginList.forEach(plugin => plugin(this))
    return this
  }

  private installGlobalPlugin () {
    (this.constructor as typeof Wechaty).globalPluginList.forEach(plugin => plugin(this))
  }

  private async initPuppet (): Promise<void> {
    log.verbose('Wechaty', 'initPuppet() %s', this.options.puppet || '')

    const initialized = !!this.puppet

    if (initialized) {
      log.verbose('Wechaty', 'initPuppet(%s) had already been initialized, no need to init twice', this.options.puppet)
      return
    }

    if (!this.memory) {
      throw new Error('no memory')
    }

    const puppet       = this.options.puppet || config.systemPuppetName()
    const puppetMemory = this.memory.multiplex(PUPPET_MEMORY_NAME)

    const puppetInstance = await PuppetManager.resolve({
      puppet,
      puppetOptions : this.options.puppetOptions,
      // wechaty       : this,
    })

    /**
     * Plug the Memory Card to Puppet
     */
    puppetInstance.setMemory(puppetMemory)

    this.initPuppetEventBridge(puppetInstance)
    this.initPuppetAccessory(puppetInstance)
  }

  protected initPuppetEventBridge (puppet: Puppet) {
    log.verbose('Wechaty', 'initPuppetEventBridge(%s)', puppet)

    const eventNameList: PuppetEventName[] = Object.keys(PUPPET_EVENT_DICT) as PuppetEventName[]
    for (const eventName of eventNameList) {
      log.verbose('Wechaty',
        'initPuppetEventBridge() puppet.on(%s) (listenerCount:%s) registering...',
        eventName,
        puppet.listenerCount(eventName),
      )

      switch (eventName) {
        case 'dong':
          puppet.on('dong', payload => {
            this.emit('dong', payload.data)
          })
          break

        case 'error':
          puppet.on('error', payload => {
            this.emit('error', new Error(payload.data))
          })
          break

        case 'heartbeat':
          puppet.on('heartbeat', payload => {
            /**
             * Use `watchdog` event from Puppet to `heartbeat` Wechaty.
             */
            // TODO: use a throttle queue to prevent beat too fast.
            this.emit('heartbeat', payload.data)
          })
          break

        case 'friendship':
          puppet.on('friendship', async payload => {
            const friendship = this.Friendship.load(payload.friendshipId)
            await friendship.ready()
            this.emit('friendship', friendship)
            friendship.contact().emit('friendship', friendship)
          })
          break

        case 'login':
          puppet.on('login', async payload => {
            const contact = this.ContactSelf.load(payload.contactId)
            await contact.ready()
            this.emit('login', contact)
          })
          break

        case 'logout':
          puppet.on('logout', async payload => {
            const contact = this.ContactSelf.load(payload.contactId)
            await contact.ready()
            this.emit('logout', contact, payload.data)
          })
          break

        case 'message':
          puppet.on('message', async payload => {
            const msg = this.Message.load(payload.messageId)
            await msg.ready()
            this.emit('message', msg)

            const room = msg.room()
            if (room) {
              room.emit('message', msg)
            }
          })
          break

        case 'ready':
          puppet.on('ready', () => {
            log.silly('Wechaty', 'initPuppetEventBridge() puppet.on(ready)')

            this.emit('ready')
            this.readyState.on(true)
          })
          break

        case 'room-invite':
          puppet.on('room-invite', async payload => {
            const roomInvitation = this.RoomInvitation.load(payload.roomInvitationId)
            this.emit('room-invite', roomInvitation)
          })
          break

        case 'room-join':
          puppet.on('room-join', async payload => {
            const room = this.Room.load(payload.roomId)
            await room.sync()

            const inviteeList = payload.inviteeIdList.map(id => this.Contact.load(id))
            await Promise.all(inviteeList.map(c => c.ready()))

            const inviter = this.Contact.load(payload.inviterId)
            await inviter.ready()
            const date = timestampToDate(payload.timestamp)

            this.emit('room-join', room, inviteeList, inviter, date)
            room.emit('join', inviteeList, inviter, date)
          })
          break

        case 'room-leave':
          puppet.on('room-leave', async payload => {
            const room = this.Room.load(payload.roomId)

            /**
             * See: https://github.com/wechaty/wechaty/pull/1833
             */
            await room.sync()

            const leaverList = payload.removeeIdList.map(id => this.Contact.load(id))
            await Promise.all(leaverList.map(c => c.ready()))

            const remover = this.Contact.load(payload.removerId)
            await remover.ready()
            const date = timestampToDate(payload.timestamp)

            this.emit('room-leave', room, leaverList, remover, date)
            room.emit('leave', leaverList, remover, date)

            // issue #254
            const selfId = this.puppet.selfId()
            if (selfId && payload.removeeIdList.includes(selfId)) {
              await this.puppet.roomPayloadDirty(payload.roomId)
              await this.puppet.roomMemberPayloadDirty(payload.roomId)
            }

          })
          break

        case 'room-topic':
          puppet.on('room-topic', async payload => {
            const room = this.Room.load(payload.roomId)
            await room.sync()

            const changer = this.Contact.load(payload.changerId)
            await changer.ready()
            const date = timestampToDate(payload.timestamp)

            this.emit('room-topic', room, payload.newTopic, payload.oldTopic, changer, date)
            room.emit('topic', payload.newTopic, payload.oldTopic, changer, date)
          })
          break

        case 'scan':
          puppet.on('scan', async payload => {
            this.emit('scan', payload.qrcode || '', payload.status, payload.data)
          })
          break

        case 'reset':
          // Do not propagation `reset` event from puppet
          break

        default:
          /**
           * Check: The eventName here should have the type `never`
           */
          throw new Error('eventName ' + eventName + ' unsupported!')

      }
    }
  }

  protected initPuppetAccessory (puppet: Puppet) {
    log.verbose('Wechaty', 'initAccessory(%s)', puppet)

    /**
     * 1. Set Wechaty
     */
    this.Contact.wechaty        = this
    this.ContactSelf.wechaty    = this
    this.Friendship.wechaty     = this
    this.Image.wechaty          = this
    this.Message.wechaty        = this
    this.Room.wechaty           = this
    this.RoomInvitation.wechaty = this
    this.Tag.wechaty            = this

    /**
     * 2. Set Puppet
     */
    this.Contact.puppet        = puppet
    this.ContactSelf.puppet    = puppet
    this.Friendship.puppet     = puppet
    this.Image.puppet          = puppet
    this.Message.puppet        = puppet
    this.Room.puppet           = puppet
    this.RoomInvitation.puppet = puppet
    this.Tag.puppet            = puppet

    this.puppet = puppet

    /**
     * Private Event
     *  emit puppet when set
     *
     * Huan(202005)
     */
    ;(this.emit as any)('puppet', puppet)
  }

  /**
   * Start the bot, return Promise.
   *
   * @returns {Promise<void>}
   * @description
   * When you start the bot, bot will begin to login, need you WeChat scan qrcode to login
   * > Tips: All the bot operation needs to be triggered after start() is done
   * @example
   * await bot.start()
   * // do other stuff with bot here
   */
  public async start (): Promise<void> {
    log.verbose('Wechaty', '<%s>(%s) start() v%s is starting...',
      this.options.puppet || config.systemPuppetName(),
      this.options.name   || '',
      this.version(),
    )
    log.verbose('Wechaty', 'id: %s', this.id)

    if (this.state.on()) {
      log.silly('Wechaty', 'start() on a starting/started instance')
      await this.state.ready('on')
      log.silly('Wechaty', 'start() state.ready() resolved')
      return
    }

    this.readyState.off(true)

    if (this.lifeTimer) {
      throw new Error('start() lifeTimer exist')
    }

    this.state.on('pending')

    try {
      if (!this.memory) {
        this.memory = new MemoryCard(this.options.name)
      }

      try {
        await this.memory.load()
      } catch (e) {
        log.silly('Wechaty', 'start() memory.load() had already loaded')
      }

      await this.initPuppet()
      await this.puppet.start()

      if (this.options.ioToken) {
        this.io = new Io({
          token   : this.options.ioToken,
          wechaty : this,
        })
        await this.io.start()
      }

    } catch (e) {
      console.error(e)
      log.error('Wechaty', 'start() exception: %s', e && e.message)
      Raven.captureException(e)
      this.emit('error', e)

      try {
        await this.stop()
      } catch (e) {
        log.error('Wechaty', 'start() stop() exception: %s', e && e.message)
        Raven.captureException(e)
        this.emit('error', e)
      }
      return
    }

    this.on('heartbeat', () => this.memoryCheck())

    this.lifeTimer = setInterval(() => {
      log.silly('Wechaty', 'start() setInterval() this timer is to keep Wechaty running...')
    }, 1000 * 60 * 60)

    this.state.on(true)
    this.emit('start')
  }

  /**
   * Stop the bot
   *
   * @returns {Promise<void>}
   * @example
   * await bot.stop()
   */
  public async stop (): Promise<void> {
    log.verbose('Wechaty', '<%s> stop() v%s is stopping ...',
      this.options.puppet || config.systemPuppetName(),
      this.version(),
    )

    if (this.state.off()) {
      log.silly('Wechaty', 'stop() on an stopping/stopped instance')
      await this.state.ready('off')
      log.silly('Wechaty', 'stop() state.ready(off) resolved')
      return
    }

    this.readyState.off(true)

    this.state.off('pending')

    if (this.lifeTimer) {
      clearInterval(this.lifeTimer)
      this.lifeTimer = undefined
    }

    try {
      await this.puppet.stop()
    } catch (e) {
      log.warn('Wechaty', 'stop() puppet.stop() exception: %s', e.message)
    }

    try {
      if (this.io) {
        await this.io.stop()
        this.io = undefined
      }

    } catch (e) {
      log.error('Wechaty', 'stop() exception: %s', e.message)
      Raven.captureException(e)
      this.emit('error', e)
    }

    this.state.off(true)
    this.emit('stop')
  }

  public async ready (): Promise<void> {
    log.verbose('Wechaty', 'ready()')
    return this.readyState.ready('on').then(() => {
      return log.silly('Wechaty', 'ready() this.readyState.ready(on) resolved')
    })
  }

  /**
   * Logout the bot
   *
   * @returns {Promise<void>}
   * @example
   * await bot.logout()
   */
  public async logout (): Promise<void>  {
    log.verbose('Wechaty', 'logout()')

    try {
      await this.puppet.logout()
    } catch (e) {
      log.error('Wechaty', 'logout() exception: %s', e.message)
      Raven.captureException(e)
      throw e
    }
  }

  /**
   * Get the logon / logoff state
   *
   * @returns {boolean}
   * @example
   * if (bot.logonoff()) {
   *   console.log('Bot logged in')
   * } else {
   *   console.log('Bot not logged in')
   * }
   */
  public logonoff (): boolean {
    try {
      return this.puppet.logonoff()
    } catch (e) {
      // https://github.com/wechaty/wechaty/issues/1878
      return false
    }
  }

  /**
   * @description
   * Should use {@link Wechaty#userSelf} instead
   * @deprecated Use `userSelf()` instead
   * @ignore
   */
  public self (): Contact {
    log.warn('Wechaty', 'self() DEPRECATED. use userSelf() instead.')
    return this.userSelf()
  }

  /**
   * Get current user
   *
   * @returns {ContactSelf}
   * @example
   * const contact = bot.userSelf()
   * console.log(`Bot is ${contact.name()}`)
   */
  public userSelf (): ContactSelf {
    const userId = this.puppet.selfId()
    const user = this.ContactSelf.load(userId)
    return user
  }

  public async say (text:     string)      : Promise<void>
  public async say (contact:  Contact)     : Promise<void>
  public async say (file:     FileBox)     : Promise<void>
  public async say (mini:     MiniProgram) : Promise<void>
  public async say (url:      UrlLink)     : Promise<void>

  public async say (...args: never[]): Promise<never>

  /**
   * Send message to userSelf, in other words, bot send message to itself.
   * > Tips:
   * This function is depending on the Puppet Implementation, see [puppet-compatible-table](https://github.com/wechaty/wechaty/wiki/Puppet#3-puppet-compatible-table)
   *
   * @param {(string | Contact | FileBox | UrlLink | MiniProgram)} something
   * send text, Contact, or file to bot. </br>
   * You can use {@link https://www.npmjs.com/package/file-box|FileBox} to send file
   *
   * @returns {Promise<void>}
   *
   * @example
   * const bot = new Wechaty()
   * await bot.start()
   * // after logged in
   *
   * // 1. send text to bot itself
   * await bot.say('hello!')
   *
   * // 2. send Contact to bot itself
   * const contact = await bot.Contact.find()
   * await bot.say(contact)
   *
   * // 3. send Image to bot itself from remote url
   * import { FileBox }  from 'wechaty'
   * const fileBox = FileBox.fromUrl('https://wechaty.github.io/wechaty/images/bot-qr-code.png')
   * await bot.say(fileBox)
   *
   * // 4. send Image to bot itself from local file
   * import { FileBox }  from 'wechaty'
   * const fileBox = FileBox.fromFile('/tmp/text.jpg')
   * await bot.say(fileBox)
   *
   * // 5. send Link to bot itself
   * const linkPayload = new UrlLink ({
   *   description : 'WeChat Bot SDK for Individual Account, Powered by TypeScript, Docker, and Love',
   *   thumbnailUrl: 'https://avatars0.githubusercontent.com/u/25162437?s=200&v=4',
   *   title       : 'Welcome to Wechaty',
   *   url         : 'https://github.com/wechaty/wechaty',
   * })
   * await bot.say(linkPayload)
   *
   * // 6. send MiniProgram to bot itself
   * const miniPayload = new MiniProgram ({
   *   username           : 'gh_xxxxxxx',     //get from mp.weixin.qq.com
   *   appid              : '',               //optional, get from mp.weixin.qq.com
   *   title              : '',               //optional
   *   pagepath           : '',               //optional
   *   description        : '',               //optional
   *   thumbnailurl       : '',               //optional
   * })
   * await bot.say(miniPayload)
   */

  public async say (
    something:  string
              | Contact
              | FileBox
              | MiniProgram
              | UrlLink
  ): Promise<void> {
    log.verbose('Wechaty', 'say(%s)', something)
    // huan: to make TypeScript happy
    await this.userSelf().say(something as any)
  }

  /**
   * @ignore
   */
  public static version (gitHash = false): string {
    if (gitHash && GIT_COMMIT_HASH) {
      return `#git[${GIT_COMMIT_HASH}]`
    }
    return VERSION
  }

  /**
   * @ignore
   * Return version of Wechaty
   *
   * @param {boolean} [forceNpm=false]  - If set to true, will only return the version in package.json. </br>
   *                                      Otherwise will return git commit hash if .git exists.
   * @returns {string}                  - the version number
   * @example
   * console.log(Wechaty.instance().version())       // return '#git[af39df]'
   * console.log(Wechaty.instance().version(true))   // return '0.7.9'
   */
  public version (forceNpm = false): string {
    return Wechaty.version(forceNpm)
  }

  /**
   * @ignore
   */
  public static async sleep (millisecond: number): Promise<void> {
    await new Promise(resolve => {
      setTimeout(resolve, millisecond)
    })
  }

  /**
   * @ignore
   */
  public async sleep (millisecond: number): Promise<void> {
    return Wechaty.sleep(millisecond)
  }

  /**
   * @private
   */
  public ding (data?: string): void {
    log.silly('Wechaty', 'ding(%s)', data || '')

    try {
      this.puppet.ding(data)
    } catch (e) {
      log.error('Wechaty', 'ding() exception: %s', e.message)
      Raven.captureException(e)
      throw e
    }
  }

  /**
   * @ignore
   */
  private memoryCheck (minMegabyte = 4): void {
    const freeMegabyte = Math.floor(os.freemem() / 1024 / 1024)
    log.silly('Wechaty', 'memoryCheck() free: %d MB, require: %d MB',
      freeMegabyte, minMegabyte,
    )

    if (freeMegabyte < minMegabyte) {
      const e = new Error(`memory not enough: free ${freeMegabyte} < require ${minMegabyte} MB`)
      log.warn('Wechaty', 'memoryCheck() %s', e.message)
      this.emit('error', e)
    }
  }

  /**
   * @ignore
   */
  public async reset (reason?: string): Promise<void> {
    log.verbose('Wechaty', 'reset() because %s', reason || 'no reason')
    await this.puppet.stop()
    await this.puppet.start()
  }

  public unref (): void {
    log.verbose('Wechaty', 'unref()')

    if (this.lifeTimer) {
      this.lifeTimer.unref()
    }

    this.puppet.unref()
  }

}
