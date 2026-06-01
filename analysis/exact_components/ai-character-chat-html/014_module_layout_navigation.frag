  function showMessageFeedHeaderBar() {
    // $.messageFeedHeaderBar.style.pointerEvents = "auto"; // Header bar STAYS on pointer-events:none so it doesn't cover 'edit this character' buttons. Children have pointer-events:auto;
    $.messageFeedHeaderBar.style.opacity = "1";
    $.messageFeed.style.paddingTop = "0rem"; //window.innerWidth < 500 ? "2.5rem" : "0rem";
  }
  function hideMessageFeedHeaderBar() {
    // $.messageFeedHeaderBar.style.pointerEvents = "none"; // Header bar STAYS on pointer-events:none so it doesn't cover 'edit this character' buttons. Children have pointer-events:auto;
    $.messageFeedHeaderBar.style.opacity = "0";
    $.messageFeed.style.paddingTop = "0";
  }

  function openLeftColumn() {
    if($.toggleRightColumnButton.offsetHeight === 0) { // PERCHANCE EDIT
      hideMessageFeedHeaderBar();
    }
    showEl($.leftColumn);
    document.querySelectorAll(".openLeftColumnButton").forEach(el => hideEl(el));
    showEl($.closeLeftColumnButton);
    if(isMobile) {
      showEl($.middleColumnShadowOverlay);
    }
  }
  function closeLeftColumn() {
    showMessageFeedHeaderBar(); // PERCHANCE EDIT
    hideEl($.leftColumn);
    document.querySelectorAll(".openLeftColumnButton").forEach(el => showEl(el));
    hideEl($.closeLeftColumnButton);
    if(isMobile) {
      hideEl($.middleColumnShadowOverlay);
    }
  }
  $.closeLeftColumnButton.addEventListener("click", closeLeftColumn);
  document.querySelectorAll(".openLeftColumnButton").forEach(el => {
    el.addEventListener("click", (e) => {
      e.stopPropagation(); // <-- since this hovers over middle column, and on mobile we close left column when they tap middle column
      openLeftColumn();
    });
  });
  if(isMobile) {
    closeLeftColumn();
    // if they click anywhere in the middle column, close the menu
    $.middleColumnShadowOverlay.addEventListener("click", (e) => {
      e.stopPropagation();
      closeLeftColumn();
    });
  }


  {
    let messageFeedHeaderBarHideTimeout = null;
    let isMouseInTriggerArea = false;
    function showMessageFeedTopMenu() {
      clearTimeout(messageFeedHeaderBarHideTimeout);
      messageFeedHeaderBarHideTimeout = null;
      showEl($.messageFeedHeaderBar);
    }
    function hideMessageFeedTopMenu() {
      if(messageFeedHeaderBarHideTimeout !== null) return; // hiding settimeout already in progress
      clearTimeout(messageFeedHeaderBarHideTimeout);
      messageFeedHeaderBarHideTimeout = setTimeout(() => {
        hideEl($.messageFeedHeaderBar);
      }, 2000);
    }
    window.addEventListener("mousemove", (e) => {
      let pageY; try { pageY = e.pageY; } catch(e) {}
      if(pageY === undefined) return; // avoid weird firefox error related to mousemove on iframe during page load

      if (pageY < 80) { // show:
        isMouseInTriggerArea = true;
        showMessageFeedTopMenu();
      } else { // hide if visible:
        isMouseInTriggerArea = false;
        if ($.messageFeedHeaderBar.offsetHeight > 0 && !lastMessageFeedScrollWasUp) {
          hideMessageFeedTopMenu();
        }
      }
    });
    let messageFeedScrollTop = 0;
    let lastMessageFeedScrollWasUp = true;
    $.messageFeed.addEventListener("scroll", function (e) {
      let newScrollTop = e.target.scrollTop;
      if (newScrollTop < messageFeedScrollTop) { // they scrolled up, so show menu
        lastMessageFeedScrollWasUp = true;
        showMessageFeedTopMenu();
      }
      // if (newScrollTop > messageFeedScrollTop) { // they scrolled down, so hide menu if their mouse isn't in trigger area
      //   lastMessageFeedScrollWasUp = false;
      //   if(!isMouseInTriggerArea || isMobile) {
      //     hideMessageFeedTopMenu();
      //   }
      // }
      if (newScrollTop > messageFeedScrollTop && !isMobile) { // they scrolled down, so if not on mobile, then hide menu button if their mouse isn't in trigger area
        lastMessageFeedScrollWasUp = false;
        if(!isMouseInTriggerArea) {
          hideMessageFeedTopMenu();
        }
      }
      messageFeedScrollTop = newScrollTop;
    }, { passive: true });
  }

  if(isMobile) {
    $.customCodeIframeHorizontalResizeBar.style.display = "none";
    $.customCodeColumn.style.width = "100%";

    $.rightColumn.style.position = "fixed";
    $.rightColumn.style.top = "0";
    $.rightColumn.style.right = "0";
    $.rightColumn.style.bottom = "0";
    $.rightColumn.style.left = "0";
    $.rightColumn.style.zIndex = "100";
    $.rightColumn.style.width = "";

    $.rightColumn.style.pointerEvents = "none";
    $.rightColumn.style.opacity = "0";

    $.toggleRightColumnButton.addEventListener("click", function() {
      if($.rightColumn.dataset.visible === "yes") {
        $.rightColumn.style.pointerEvents = "none";
        $.rightColumn.style.opacity = "0";
        $.rightColumn.dataset.visible = "no";
        $.toggleRightColumnButton.textContent = "⚛️";
      } else {
        $.rightColumn.style.pointerEvents = "";
        $.rightColumn.style.opacity = "1";
        $.rightColumn.dataset.visible = "yes";
        $.toggleRightColumnButton.textContent = "💬";
      }
    });
  }

  console.log("load log: before db init", Date.now()-window.pageLoadStartTime);

