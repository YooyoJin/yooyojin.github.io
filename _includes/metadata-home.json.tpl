{
    "page": {
        "title": "Introduction",
        "level": "1.1",
        "depth": 1,

        {% if site.posts.last %}
        "next": {
            "title": "{{site.posts.last.title}}",
            "level": "1.2",
            "depth": 1,
            "path": "{{site.posts.last.path}}",
            "ref": "{{site.posts.last.path}}",
            "articles": []
        },
        {% endif %}
        "dir": "ltr"
    },

    {%- include metadata.json.tpl -%}
}