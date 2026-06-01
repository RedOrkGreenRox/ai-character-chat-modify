//         The user will respond with their character's thoughts/actions/dialogue.`),
//       reminderMessage: "",
//       initialMessages: [
//         {author:"system", hiddenFrom:["ai"], content:`Hello there! This character has some custom code that makes it output an image after each message, and the image should match the facial expression of the message. You can edit this character and show advanced options and you'll see the custom code which does this. You can easily edit the \`expression:url\` list to your liking.\n\nNote that the AI cannot see this message (the one you're reading right now), as indicated by the "blind" icon above this system message.`}
//       ],
//       modelName: "perchance-ai",
//       avatar: {
//         url: "https://i.imgur.com/EGDfzaN.jpeg",
//       },
//       fitMessagesInContextMethod: "summarizeOld",
//       customCode: dedent(`
//         // Note: You can add multiple URLs for a single label and a random one will be selected.
//         // Separate urls with "|" like this:
//         // <expression>: https://example.com/image1.jpg | https://example.com/image2.jpg
