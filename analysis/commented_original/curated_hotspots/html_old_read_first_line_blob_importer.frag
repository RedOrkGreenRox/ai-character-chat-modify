  // async function readFirstLineOfTextBlob(file) {
  //   const reader = file.stream().getReader();
  //   const decoder = new TextDecoder("utf-8");
  //   let { value: chunk, done: readerDone } = await reader.read();
  //   let buffer = '';
  //   while (!readerDone) {
  //     buffer += decoder.decode(chunk, { stream: true });
  //     let lines = buffer.split('\n');
  //     if (lines.length > 1) {
  //       return lines[0];
  //     }
  //     ({ value: chunk, done: readerDone } = await reader.read());
  //   }
  //   // Handle the case where the first line is the only line
  //   buffer += decoder.decode();
  //   if (buffer) {
  //     return buffer.split('\n')[0];
  //   }
  //   // Return an empty string if no content
  //   return '';
  // }
