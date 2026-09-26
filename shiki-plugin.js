(function () {
    'use strict';

    function startPlugin() {
        if (window.lampa_started) ready();
        else Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') ready(); });
    }

    function ready() {
        Lampa.Component.add('shikimori_page', ShikimoriComponent); 

        // Проверяем, чтобы кнопка в меню не дублировалась при перезагрузке
        if (!window.shikimori_menu_added) {
            Lampa.Menu.add({
                id: 'shikimori_plugin',
                title: 'Shikimori',
                icon: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/></svg>',
                onSelect: function () {
                    Lampa.Activity.push({
                        plugin: 'shikimori_plugin',
                        component: 'shikimori_page',
                        title: 'Shikimori Каталог'
                    });
                }
            });
            window.shikimori_menu_added = true;
        }
    }

    function ShikimoriComponent(object) {
        var comp = this;
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var html = $('<div></div>');
        var body = $('<div class="category-full"></div>');
        var network = new Lampa.Reguest(); // Встроенный модуль запросов Lampa

        // Переменные для загрузки и страниц
        var is_loading = false;
        var current_page = 1;
        var has_more = true;

        // Текущие активные фильтры
        var filter_params = {
            order: 'popularity',
            kind: '',
            status: ''
        };

        // Текстовые названия для меню Lampa
        var filter_names = {
            order: {
                'popularity': 'По популярности',
                'ranked': 'По рейтингу',
                'aired_on': 'По дате выхода',
                'name': 'По алфавиту',
                'random': 'Случайные'
            },
            kind: {
                '': 'Все типы',
                'tv': 'ТВ Сериал',
                'movie': 'Фильм',
                'ova': 'OVA',
                'ona': 'ONA',
                'special': 'Спешл'
            },
            status: {
                '': 'Любой статус',
                'released': 'Вышло',
                'ongoing': 'Онгоинг',
                'anons': 'Анонс'
            }
        };

        this.create = function () {
            html.append(scroll.render());
            scroll.append(body);
            
            this.buildFilterButton();
            this.loadData();
            
            // Обработчик достижения конца страницы (бесконечный скролл)
            scroll.onEnd = function () {
                if (!is_loading && has_more) {
                    current_page++;
                    comp.loadData();
                }
            };

            return this.render();
        };

        // Создание кнопки вызова меню фильтров
        this.buildFilterButton = function () {
            // Используем стандартный класс Lampa (settings-folder) для красивой кнопки на всю ширину
            var filter_btn = $('<div class="settings-folder" style="margin-bottom: 20px;"><div class="settings-folder__icon"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/></svg></div><div class="settings-folder__name">Фильтры и сортировка</div><div class="settings-folder__value">Настроить поиск</div></div>');
            
            filter_btn.on('hover:enter', function () {
                var menu = [
                    { title: 'Сортировка: ' + filter_names.order[filter_params.order], type: 'order' },
                    { title: 'Тип: ' + filter_names.kind[filter_params.kind], type: 'kind' },
                    { title: 'Статус: ' + filter_names.status[filter_params.status], type: 'status' }
                ];

                Lampa.Select.show({
                    title: 'Фильтры',
                    items: menu,
                    onSelect: function (a) {
                        if (a.type === 'order') {
                            Lampa.Select.show({
                                title: 'Сортировка',
                                items: [
                                    { title: 'По популярности', value: 'popularity' },
                                    { title: 'По рейтингу', value: 'ranked' },
                                    { title: 'По дате выхода', value: 'aired_on' },
                                    { title: 'По алфавиту', value: 'name' },
                                    { title: 'Случайные', value: 'random' }
                                ],
                                onSelect: function (b) {
                                    filter_params.order = b.value;
                                    comp.reload();
                                }
                            });
                        } else if (a.type === 'kind') {
                            Lampa.Select.show({
                                title: 'Тип',
                                items: [
                                    { title: 'Все типы', value: '' },
                                    { title: 'ТВ Сериал', value: 'tv' },
                                    { title: 'Фильм', value: 'movie' },
                                    { title: 'OVA', value: 'ova' },
                                    { title: 'ONA', value: 'ona' },
                                    { title: 'Спешл', value: 'special' }
                                ],
                                onSelect: function (b) {
                                    filter_params.kind = b.value;
                                    comp.reload();
                                }
                            });
                        } else if (a.type === 'status') {
                            Lampa.Select.show({
                                title: 'Статус',
                                items: [
                                    { title: 'Любой статус', value: '' },
                                    { title: 'Вышло', value: 'released' },
                                    { title: 'Онгоинг', value: 'ongoing' },
                                    { title: 'Анонс', value: 'anons' }
                                ],
                                onSelect: function (b) {
                                    filter_params.status = b.value;
                                    comp.reload();
                                }
                            });
                        }
                    }
                });
            });
            
            body.append(filter_btn);
        };

        // Очистка каталога при смене фильтра
        this.reload = function () {
            // Удаляем всё, кроме кнопки фильтров
            body.find('.card').remove();
            body.find('.empty').remove();
            
            current_page = 1;
            has_more = true;
            this.loadData();
        };

        this.loadData = function () {
            is_loading = true;
            
            // Формируем URL с учетом выбранных параметров
            var url = 'https://shikimori.one/api/animes?limit=30&page=' + current_page + '&order=' + filter_params.order;
            if (filter_params.kind) url += '&kind=' + filter_params.kind;
            if (filter_params.status) url += '&status=' + filter_params.status;

            network.silent(url, function(data) {
                if (data && data.length) {
                    comp.build(data);
                    // Если Shikimori вернул меньше лимита, значит страниц больше нет
                    if (data.length < 30) has_more = false;
                } else {
                    has_more = false;
                    if (current_page === 1) body.append('<div class="empty">По этим фильтрам ничего не найдено</div>');
                }
                is_loading = false;
            }, function(a, c) {
                if (current_page === 1) body.append('<div class="empty">Ошибка загрузки данных с API Shikimori</div>');
                is_loading = false;
            });
        };

        this.build = function (data) {
            data.forEach(function (element) {
                var item = {
                    title: element.russian || element.name,
                    original_title: element.name,
                    release_date: element.released_on,
                    img: 'https://shikimori.one' + element.image.original,
                    background: 'https://shikimori.one' + element.image.original
                };

                var card = Lampa.Template.get('card', item);
                card.find('.card__image').attr('src', item.img);

                // Добавляем красивый значок оценки прямо поверх постера, если рейтинг больше 0
                if (element.score && element.score !== "0.0") {
                    card.find('.card__view').append('<div class="card__vote">' + parseFloat(element.score).toFixed(1) + '</div>');
                }

                // При клике на карточку запускаем глобальный поиск Lampa по названию
                // Это лучший способ, так как у Shikimori нет ID, напрямую совместимых с плеерами Lampa.
                card.on('hover:enter', function () {
                    Lampa.Activity.push({
                        component: 'search',
                        query: item.title
                    });
                });

                body.append(card);
            });
        };

        this.render = function () {
            return html;
        };

        this.destroy = function () {
            network.clear();
            scroll.destroy();
            html.remove();
            body.remove();
        };
    }

    startPlugin();
})();