          // if(url.startsWith("https://charhub.ai/") && doc.querySelector(`form.button_to[action="/conversations"] [name="authenticity_token"]`)) {
          //   try {
          //     let convHtml = await root.superFetch("https://charhub.ai/conversations", {
          //       headers: { "content-type": "application/x-www-form-urlencoded" },
          //       body: `authenticity_token=${doc.querySelector(`form.button_to[action="/conversations"] [name="authenticity_token"]`).value}&conversation%5Bcharacter_id%5D=${url.split("/").pop().split("?")[0]}&conversation%5Bis_public%5D=false`,
          //       method: "POST",
          //     }).then(r => r.text()).catch(console.warn);
          //     if(convHtml) {
          //       let convDoc = new DOMParser().parseFromString(convHtml, "text/html");
          //       convDoc.querySelectorAll("script").forEach(el => el.remove());
          //       content += convDoc.body.textContent.replace(/\n+/g, "\n").replace(/ +/g, " ").replace(/( \n)+/g, "\n").replace(/(\n )+/g, "\n");
          //     }
          //   } catch(e) {
          //     console.warn(e);
          //   }
          // }
