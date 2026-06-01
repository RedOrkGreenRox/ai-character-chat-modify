    // we MUST NOT set display:none here, because otherwise window.innerWidth/innerHeight are zero on init, which can confuse plugin devs.
    // instead we set opacity:0 and pointer-events:none, and then switch to display:none after load.
