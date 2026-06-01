  // PERCHANCE EDIT
  // async function getOpenAiApiKey() {
  //   let apiKey = (await db.misc.get("openAiApiKey"))?.value;
  //   while(!apiKey) {
  //     let result = await prompt2({
  //       openAiApiKey: { label: "Please create a new OpenAI API secret key and paste it here. Go to <a style='color:blue' href='https://platform.openai.com/account/api-keys' target='_blank'>this page</a> to do that. You can change or delete this later by clicking the 'settings' button.", type:"textLine", placeholder:"sk-...", focus:true },
  //     });
  //     if(!result || !result.openAiApiKey) continue;
  //     apiKey = result.openAiApiKey;
  //     break;
  //   }
  //   await db.misc.put({ key: "openAiApiKey", value: apiKey });
  //   return apiKey;
  // }
