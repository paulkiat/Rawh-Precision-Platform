(async () => {

  const { chat } = await require('../llm/api').init();
  
  await chat.setup();

  const ssn1 = await chat.create_session();
  await ssn1.prompt_debug("why is the earth called a pale blue dot?");
  await ssn1.prompt_debug("shorter answer please");
  await ssn1.prompt_debug("what was my question");

})();