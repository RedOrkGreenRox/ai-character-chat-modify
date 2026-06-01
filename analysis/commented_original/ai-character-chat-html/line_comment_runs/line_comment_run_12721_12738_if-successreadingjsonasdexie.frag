      // if(!successReadingJsonAsDexie) {
      //   // parsing as "first line is JSON, subsequent lines are row objects" format
      //   json = undefined; // <-- just to be safe in case of bugs introduced above
      //   try {
      //     for await (let line of readTextBlobLineByLine(file)) {
      //       if(!line.trim()) continue;
      //       if(!json) { // first line is the dexie JSON without any rows in the tables
      //         json = JSON.parse(line.trim());
      //         if(json.formatName !== "dexie") return "fail";
      //       } else { // subsequent lines are row objects that have the table name before a "|", and the row JSON after it
      //         let type = line.slice(0, line.indexOf("|"));
      //         let row = JSON.parse(line.slice(line.indexOf("|")+1));
      //         json.data.data.find(d => d.tableName === type).rows.push(row);
      //       }
      //     }
      //     successReadingJsonAsDexie = true;
      //   } catch(e) {}
      // }
