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
 import type * as PUPPET  from 'wechaty-puppet'
 import { log, type } from 'wechaty-puppet'
import type { Constructor } from '../deprecated/clone-class.js'
import { validationMixin } from '../user-mixins/validation.js'
import { instanceToClass } from 'file-box/node_modules/clone-class'
import {
  PostImpl,
  PostInterface,
} from './post.js'
import type { FileBoxInterface } from 'file-box'
import type { PaginationRequest } from './post-puppet-api.js'
import type { SayablePayload } from './post-sayable-payload-list.js'

class MomentMixin extends PostImpl {

  static async post (post: PostInterface): Promise<void | PostImpl> {
    const momentPayload = this.generateMomentPayload(post)
    const momentId = await this.wechaty.puppet.momentPost(momentPayload)
    if (momentId) {
      const newPost = instanceToClass(this, PostImpl).load(momentId)
      await newPost.ready()
      return newPost
    }
  }

  private static generateMomentPayload (
    post: PostInterface,
  ): PUPPET.payload.Moment {
    let textMaterial: string | undefined
    let videoMaterial: FileBoxInterface | undefined
    let urlMaterial: PUPPET.payload.UrlLink | undefined
    const imageMaterialList: FileBoxInterface[] = []

    const { sayableList } = post.payload
    for (const sayable of sayableList) {
      const item = sayable as SayablePayload
      switch (item.type) {
        case type.Message.Text:
          textMaterial = item.payload
          break
        case type.Message.Video:
          videoMaterial = item.payload
          break
        case type.Message.Image:
          imageMaterialList.push(item.payload)
          break
        case type.Message.Url:
          urlMaterial = item.payload
          break
        default:
          throw new Error('Can not convert sayable to moment material when create moment payload')
      }
    }

    // FIXME: check there has one material at least, e.g. [text] + [image* | video | url]
    const momentPayload: PUPPET.payload.Moment = {
      textMaterial,
      imageMaterialList,
      videoMaterial,
      urlMaterial,
    }
    return momentPayload
  }

  static async setSignature (text: string) {
    return this.wechaty.puppet.momentSignature(text)
  }

  static async setCoverage (filebox: FileBoxInterface) {
    return this.wechaty.puppet.momentCoverage(filebox)
  }

  async remove (id: string) {
    return this.wechaty.puppet.momentRemove(id)
  }


  static async timeline (
    pagination : PaginationRequest = {},
  ): Promise<[
    momentList     : PostInterface[],
    nextPageToken? : string,
  ]> {
    log.verbose('Post', 'timeline(%s)',
      Object.keys(pagination).length ? ', ' + JSON.stringify(pagination) : '',
    )

    const ret = await this.wechaty.puppet.momentList(pagination)

    const nextPageToken = ret.nextPageToken
    const response = ret.response

    const momentList: PostInterface[] = []
    for (const momentId of response) {
      const moment = this.wechaty.Post.load(momentId)
      try {
        await moment.ready()
      } catch (e) {
        log.warn('Post', 'timeline() moment.ready() rejection: %s', (e as Error).message)
        continue
      }
      momentList.push(moment)
    }

    return [momentList, nextPageToken]
  }

  /*
   * @hideconstructor
   */
  constructor () {
    super()
    log.verbose('Moment', 'constructor()')
  }

}

class MomentImpl extends validationMixin(MomentMixin)<MomentInterface>() {}
interface MomentInterface extends MomentImpl {}
type MomentConstructor = Constructor<
  MomentInterface,
  typeof MomentImpl
>

export type {
  MomentConstructor,
  MomentInterface,
}
export {
  MomentImpl,
}
