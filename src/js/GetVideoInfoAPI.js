import './api_jsdoc.js'

export class GetVideoInfoAPI {

    static _end_point = "https://www.nicovideo.jp/api/watch/v3_guest/"

    static query_params = {
		"_frontendId": 2,
		"_frontendVersion": 9.46,
    };

    /**
     * ランダム文字列を生成する
     * @param {number} digit 文字列の桁数
     * @param {number} radix 使用する文字の種類数。[0-9a-z]から指定した個数の種類だけ使用される
     * @returns length == digitの文字列
     */
    static create_random_string(digit, radix) {
        return [...Array(digit)].map(() => Math.floor(Math.random() * radix).toString(radix).substring(0, 1)).join("");
    };

    /**
     * 指定した動画IDでAPIを呼び出し、そのレスポンスをそのまま返す
     * @param {string} video_id 動画ID
     * @returns {Promise<any>}
     */
    static async fetch_internal(video_id) {
        /** @type {string} クエリパラメータの一つ */
        const actionTrackId = this.create_random_string(10, 36) + "_" + Date.now().toString();

        let url = `${this._end_point}${video_id}?`;
        let i = 0;
        for (const param in this.query_params) {
            if (i > 0) url += "&";
            url += `${param}=${this.query_params[param]}`;
            ++i;
        }
        if (i > 0) url += "&";
        url += `actionTrackId=${actionTrackId}`;
    
        console.log(`GetVideoInfoAPI: fetch_internal "${url}"`);

        const res = await fetch(url).then(r => r.json()).catch(e => ({ meta: { status: -1 }, data: e }));

        if (res.meta.status < 0) {
            if (typeof(res.data) === 'string') throw res.data;
            else throw JSON.stringify(res.data);
        }

        return res;
    }

    /**
     * 指定したIDを持つ動画情報を取得する
     * @param {string} video_id 動画ID (soDDDDDDD等)
     * @returns {Promise<VideoInfoResponse>}
     */
    static async fetch(video_id) {
        const res = await this.fetch_internal(video_id);
        if (!res.data) throw res.errorCode;

        return {
            channel_id: res.data.channel ? res.data.channel.id : null,
            quoted: new Set(res.data.comment.threads.map(x => x.videoId)).size > 1,
            video: {
                id: res.data.video.id,
                title: res.data.video.title,
                count: {
                    comment: res.data.video.count.comment
                }
            }
        };
    }
}