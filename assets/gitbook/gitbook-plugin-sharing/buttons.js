// 移除分享按钮功能，添加返回主页按钮
require(['gitbook', 'jquery'], function(gitbook, $) {
    var SITES = {
        'facebook': {
            'label': 'Facebook',
            'icon': 'fa fa-facebook',
            'onClick': function(e) {
                e.preventDefault();
                window.open('http://www.facebook.com/sharer/sharer.php?s=100&p[url]='+encodeURIComponent(location.href));
            }
        },
        'twitter': {
            'label': 'Twitter',
            'icon': 'fa fa-twitter',
            'onClick': function(e) {
                e.preventDefault();
                window.open('http://twitter.com/home?status='+encodeURIComponent(document.title+' '+location.href));
            }
        },
        'github': {
            'label': 'Github',
            'icon': 'fa fa-github',
            'onClick': function(e) {
                e.preventDefault();
                window.open('https://github.com');
            }
        },
        'telegram': {
            'label': 'Telegram',
            'icon': 'fa fa-telegram',
            'onClick': function(e) {
                e.preventDefault();
                window.open('https://t.me');
            }
        },
        'google': {
            'label': 'Google+',
            'icon': 'fa fa-google-plus',
            'onClick': function(e) {
                e.preventDefault();
                window.open('https://plus.google.com/share?url='+encodeURIComponent(location.href));
            }
        },
        'weibo': {
            'label': 'Weibo',
            'icon': 'fa fa-weibo',
            'onClick': function(e) {
                e.preventDefault();
                window.open('http://service.weibo.com/share/share.php?content=utf-8&url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title));
            }
        },
        'instapaper': {
            'label': 'Instapaper',
            'icon': 'fa fa-instapaper',
            'onClick': function(e) {
                e.preventDefault();
                window.open('http://www.instapaper.com/text?u='+encodeURIComponent(location.href));
            }
        },
        'vk': {
            'label': 'VK',
            'icon': 'fa fa-vk',
            'onClick': function(e) {
                e.preventDefault();
                window.open('http://vkontakte.ru/share.php?url='+encodeURIComponent(location.href));
            }
        }
    };

    gitbook.events.bind('start', function(e, config) {
        var opts = config.sharing;

        // 添加自定义CSS调整图标位置
        $('<style>')
            .text(`
                .home-button-icon {
                    font-size: 17px !important;
                    position: relative;
                    top: 1.1px !important;  /* 向下移动1像素 */
                }
            `)
        .appendTo('head');

        // 创建返回主页按钮
        gitbook.toolbar.createButton({
            icon: 'fa fa-home home-button-icon', // 主页图标，添加自定义class
            label: 'Home', // 按钮标签
            position: 'left',
            onClick: function(e) {
                e.preventDefault();
                // 跳转到主页，您可以根据需要修改主页URL
                window.location.href = '/'; // 或者使用具体的主页URL
            }
        });

        // 创建分享下拉菜单（可选，如果您还想保留分享功能）
        var menu = $.map(opts.all, function(id) {
            var site = SITES[id];

            return {
                text: site.label,
                onClick: site.onClick
            };
        });

        // 如果还需要分享下拉菜单，取消下面的注释
        /*
        if (menu.length > 0) {
            gitbook.toolbar.createButton({
                icon: 'fa fa-share-alt',
                label: 'Share',
                position: 'right',
                dropdown: [menu]
            });
        }
        */

        // 直接分享按钮（可选）
        /*
        $.each(SITES, function(sideId, site) {
            if (!opts[sideId]) return;

            var onClick = site.onClick;

            var side_link = opts[`${sideId}_link`]
            if (side_link !== undefined && side_link !== "") {
                onClick = function(e) {
                    e.preventDefault();
                    window.open(side_link);
                }
            }

            gitbook.toolbar.createButton({
                icon: site.icon,
                label: site.text,
                position: 'right',
                onClick: onClick
            });
        });
        */
    });
});