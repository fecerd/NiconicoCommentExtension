/**
 * @typedef VideoDetails 動画情報
 * @property {string} id 動画ID
 * @property {string} title 動画タイトル
 * @property {{ comment: number }} count 動画に関連する数値(コメント数)
 */

/**
 * @typedef VideoInfoResponse GetVideoInfoAPIが返す正常レスポンス
 * @property {string | null} channel_id チャンネルID
 * @property {boolean} quoted 引用コメントが存在するか
 * @property {VideoDetails} video 動画情報
 * 
 */

/**
 * @typedef CommentType コメント型
 * @property {number} vpos_ms コメントの時刻 (ms)
 * @property {string} data コメント文字列
 * @property {string[]} commands コメントの付加情報
 */

/**
 * @typedef SearchResultType 検索結果型
 * @property {{ status: number, id: string, totalCount: number }} meta
 * @property {{ channelId: number | null, commentCounter: number, contentId: string, lengthSeconds: number, thumbnailUrl: string, title: string }[]} data
 */

/**
 * @typedef BackgroundResponse バックグラウンドから返されるAPIレスポンス
 * @property {boolean} status 成功したか
 * @property {string | object} result statusがtrueのとき、APIのレスポンス(文字列かjsonオブジェクト)。statusがfalseのとき、エラー文字列。
 */
