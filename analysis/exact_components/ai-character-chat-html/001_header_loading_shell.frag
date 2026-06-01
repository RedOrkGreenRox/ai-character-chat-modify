<!--

Note: Since people have asked: You can consider all the code below to be open source under the standard MIT licenced.
I.e. you're free to do as you wish with it, including copying it, hosting it yourself, and using it commercially.

-->

<script>window.pageLoadStartTime = Date.now(); console.log("pageLoadStartTime:", window.pageLoadStartTime);</script>
<script>window.dbName = "chatbot-ui-v1";</script>
<div id="initialPageLoadingModal" style="pointer-events:none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.8); z-index: 100; display: flex; justify-content: center; align-items: center; padding: 1rem; z-index: 99999999;"><div style="background-color: white; border-radius: 3px; background-color: var(--background); border-radius: var(--border-radius); padding: 1rem; text-align: center; box-shadow: 0px 1px 10px 3px rgb(130 130 130 / 24%);">Loading...</div></div>

<div id="emergencyExportCtn" hidden style="width:100%; position:fixed; top:1rem; z-index:1000;">
  <div style="background:var(--box-color); border: 2px solid red; border-radius:var(--border-radius); margin:0 auto; padding:1rem; max-width:max-content; text-align:center;">
    <div style="font-size:80%; display:block; text-align:center; margin-bottom: 0.5rem; color:red; font-weight:bold;">Error during load?<br>Try reloading the page, or:</div>
    <button id="emergencyExportBtn" onclick="emergencyExportClickHandler(this)" style="font-size:160%;">💾 export data</button>
    <button id="emergencyDeleteDataBtn" hidden onclick="emergencyDeleteAllDataClickHandler(this)" style="font-size:160%; display:block; margin:0 auto; margin-top:2rem;">🚨 delete all data</button>
  </div>
</div>

