(async () => {

  const { chat, token } = await require('../llm/api').init();
  const { clean_text, pdf_to_text, text_to_chunks } = token.default;

  await chat.setup();

  console.log({ token });

  // const ssn1 = await chat.create_sessions();
  // await ssn1.prompt_debug("Why is the earth called a pale blue dot?");
  // await ssn1.prompt_debug("Shorter answer please");
  // await ssn1.prompt_debug("What was my qwuestion?");
})