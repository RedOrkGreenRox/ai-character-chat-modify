    // // text-to-image parsing:
    // messageHtml = messageHtml.replace(/<p>\/image (.+?)<\/p>/g, function(m, p1) {
    //   return "<div>"+root.textToImagePlugin({
    //     prompt: p1, // note that this can include params via the `(seed:::123)` type notation
    //     // EDIT: commenting this out for now because what if they re-roll the iframe? you'd have multiple setTimeouts. This is just an optimization anyway, so I'm leaving it out for now. t2i plugin maybe needs an 'onRegen' handler?
    //     // onFinish: (result) => {
    //     //   let iframe = result.iframe;
    //     //   let canvas = result.canvas;
    //     //   // after a while, replace the iframe with a canvas for performance reasons:
    //     //   setTimeout(() => {
    //     //     if(document.body.contains(iframe)) {
    //     //       iframe.replaceWith(canvas);
    //     //     }
    //     //   }, 1000*60*15);
    //     // },
    //   })+"</div>";
    // });
