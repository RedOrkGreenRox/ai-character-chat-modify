  // function shortcutsFromTextFormat(text) {
  //   const regex = /(?:^|\n+)@name=(.*?)\n@message=(.*?)\n@insertionType=(replace|append|prepend)\n@autoSend=(yes|no)\n@clearAfterSend=(yes|no)/gs;
  //   let matches;
  //   let parsedShortcuts = [];
  //   while((matches = regex.exec(text))) {
  //     let shortcut = {
  //       name: matches[1],
  //       message: matches[2],
  //       insertionType: matches[3],
  //       autoSend: matches[4] === 'yes',
  //       clearAfterSend: matches[5] === 'yes',
  //       type: "message",
  //     };
  //     parsedShortcuts.push(shortcut);
  //   }
  //   return parsedShortcuts;
  // }
