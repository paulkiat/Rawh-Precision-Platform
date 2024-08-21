exports.init = async function () {
  return {
    chat: await import('./chat.mjs'),
    embed: await import('./embed.mjs'),
    token: await import('./token.mjs')
  };
};