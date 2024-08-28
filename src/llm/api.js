// this odd call pattern is used because some of the code
// backing this api are written as ESM modules requiring
// async import in nodejs world
//
// typically this will be required with an await, such as:
// const llm_api = await.require('../llm/api).init();

exports.init = async function () {
  return {
    chat: await import('./chat.mjs'),
    embed: await import('./embed.mjs'),
    token: await import('./token.mjs'),
  };
};