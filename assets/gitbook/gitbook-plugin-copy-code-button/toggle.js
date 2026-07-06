require(["gitbook", "jquery"], function (gitbook, $) {
    function selectElementText(el) {
        var range = document.createRange();
        range.selectNodeContents(el);
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    function getSelectedText() {
        var t = '';
        if (window.getSelection) {
            t = window.getSelection();
        } else if (document.getSelection) {
            t = document.getSelection();
        } else if (document.selection) {
            t = document.selection.createRange().text;
        }
        return t;
    }

    function copyToClipboard(text) {
        if (window.clipboardData && window.clipboardData.setData) {
            // IE specific code path to prevent textarea being shown while dialog is visible.
            return clipboardData.setData("Text", text);

        } else if (document.queryCommandSupported && document.queryCommandSupported("copy")) {
            var textarea = document.createElement("textarea");
            textarea.textContent = text;
            textarea.style.position = "fixed";  // Prevent scrolling to bottom of page in MS Edge.
            document.body.appendChild(textarea);
            textarea.select();
            try {
                return document.execCommand("copy");  // Security exception may be thrown by some browsers.
            } catch (ex) {
                console.warn("Copy to clipboard failed.", ex);
                return false;
            } finally {
                document.body.removeChild(textarea);
            }
        }
    }

    function expand(chapter) {
        chapter.show();
        if (chapter.parent().attr('class') != 'summary'
            && chapter.parent().attr('class') != 'book-summary'
            && chapter.length != 0
        ) {
            expand(chapter.parent());
        }
    }

    gitbook.events.bind("page.change", function () {
        $("pre").each(function () {
            // pre 自身仍可作为定位上下文（兜底），但 Copy 按钮不再放进 pre。
            // pre 是横向滚动容器，按钮放进去会随横向滚动移动，无法钉在右上角。
            // 这里把按钮放进外层不滚动的包裹层（.collapsible-wrap）；
            // 若没有包裹层（未启用折叠），则放进 pre 的父元素。
            var $pre = $(this);

            var $copyCodeButton = $("<button class='copy-code-button'>Copy</button>");
            $copyCodeButton.css({ "position": "absolute", "top": "5px", "right": "5px", "padding": "3px", "background-color": "#313E4E", "color": "white", "border-radius": "5px", "-moz-border-radius": "5px", "-webkit-border-radius": "5px", "border": "2px solid #CCCCCC" });
            $copyCodeButton.click(function () {
                // 按钮已搬到外层包裹层，用 closest 回找 code；兜底用 siblings。
                var $codeContainer = $(this).closest('.collapsible-wrap').find('code').first();
                if (!$codeContainer.length) {
                    $codeContainer = $(this).siblings("code").first();
                    if (!$codeContainer.length) {
                        $codeContainer = $(this).parent().find('code').first();
                    }
                }
                if ($codeContainer.length) {
                    selectElementText($codeContainer.get(0));
                    var selectedText = getSelectedText();

                    var buttonNewText = "";
                    if (copyToClipboard(selectedText) == true) {
                        buttonNewText = "Copied";
                        selectElementText($codeContainer.get(0));
                    } else {
                        buttonNewText = "Unable to copy";
                        selectElementText($codeContainer.get(0));
                    }

                    $(this).text(buttonNewText);
                    var that = this;
                    setTimeout(function () {
                        $(that).text("Copy");
                    }, 2000);
                }
            });

            // 优先放进 .collapsible-wrap（不随 pre 横向滚动），兜底放进父元素。
            var $host = $pre.closest('.collapsible-wrap');
            if (!$host.length) {
                $host = $pre.parent();
            }
            $host.css("position", "relative");
            $host.append($copyCodeButton);
        });
    });
});