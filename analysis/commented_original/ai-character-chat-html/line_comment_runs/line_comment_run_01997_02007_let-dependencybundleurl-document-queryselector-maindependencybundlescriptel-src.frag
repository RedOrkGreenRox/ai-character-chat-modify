  // let dependencyBundleUrl = document.querySelector("#mainDependencyBundleScriptEl").src;
  // if(!window.DOMPurify) { // not sure why, but for some people it's not loading, so try downloading again
  //   console.error("window.DOMPurify is falsy. Downloading dependencyBundleUrl and adding script dynamically.");
  //   const script = document.createElement('script');
  //   let content = await fetch(dependencyBundleUrl+`?v=${Math.random()}`).then(r => r.text()).catch(console.error);
  //   if(content === undefined) { // maybe user.uploads.dev domain blocked for some reason
  //     content = await root.superFetch(dependencyBundleUrl+`?v=${Math.random()}`).then(r => r.text()).catch(console.error);
  //   }
  //   script.textContent = content;
  //   document.head.appendChild(script); // note: this executes the script *synchronously* which is what we need here
  // }
