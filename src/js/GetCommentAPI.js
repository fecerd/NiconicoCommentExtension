import './api_jsdoc.js'
import { GetVideoInfoAPI } from './GetVideoInfoAPI.js'

export class GetCommentAPI {

    /**
     * 指定した動画IDでAPIを呼び出し、そのレスポンスをそのまま返す
     * @param {string} video_id コメントを取得する動画ID
     * @returns {Promise<{ res: any, thread_ids: number[] }>}
     */
    static async fetch_internal(video_id) {
        const video_info_res = await GetVideoInfoAPI.fetch_internal(video_id);

        /** @type number[] */
        const target_thread_ids = [...new Set(video_info_res.data.comment.threads.filter(x => x.videoId == video_id).map(x => x.id))];

        const nv_comment = video_info_res.data.comment.nvComment;

        const headers = {
            "x-frontend-id": 2
        };

        const comment_param = {
            params: nv_comment.params,
            threadKey: nv_comment.threadKey,
            additional: {}
        };

        const end_point = `${nv_comment.server}/v1/threads`;

        console.log(`GetCommentAPI: fetch_internal "${end_point}"`);

        const comment_res = await fetch(end_point, { method: "POST", headers: headers, body: JSON.stringify(comment_param) })
                                    .then(res => res.json())
                                    .catch(e => ({ meta: { status: -1 }, data: e }));

        if (comment_res.meta.status < 0) {
            throw comment_res.data;
        }
        return {
            res: comment_res,
            thread_ids: target_thread_ids
        };
    }

    /**
     * 指定した動画IDを持つ動画のコメントを取得する
     * @param {string} video_id 動画ID (soDDDDDDD等)
     * @returns {Promise<CommentType[]>}
     */
    static async fetch(video_id) {
        const { res, thread_ids } = await this.fetch_internal(video_id);

        /** @type {CommentType[]} */
        const ret = [];

        for (const thread of res.data.threads) {
            if (thread_ids.includes(Number(thread.id))) {
                for (const comment of thread.comments) {
                    ret.push({
                        vpos_ms: Number(comment.vposMs),
                        data: comment.body,
                        commands: comment.commands
                    });
                }
            }
        }

        return ret.sort((a, b) => a.vposMs - b.vposMs);
    }
}