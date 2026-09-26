(function () {
    'use strict';

    function startPlugin() {
        if (window.lampa_started) ready();
        else Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') ready(); });
    }

    function ready() {
        Lampa.Component.add('shikimori_page', ShikimoriComponent); 

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
        var network = new Lampa.Reguest(); 

        var is_loading = false;
        var current_page = 1;
        var has_more = true;

        var filter_params = {
            order: 'popularity',
            kind: '',
            status: ''
        };

        var filter_names = {
            order: { 'popularity': 'По популярности', 'ranked': 'По рейтингу', 'aired_on': 'По дате выхода', 'name': 'По алфавиту', 'random': 'Случайные' },
            kind: { '': 'Все типы', 'tv': 'ТВ Сериал', 'movie': 'Фильм', 'ova': 'OVA', 'ona': 'ONA', 'special': 'Спешл' },
            status: { '': 'Любой статус', 'released': 'Вышло', 'ongoing': 'Онгоинг', 'anons': 'Анонс' }
        };

        this.create = function () {
            html.append(scroll.render());
            scroll.append(body);
            
            this.buildFilterButton();
            this.loadData();
            
            scroll.onEnd = function () {
                if (!is_loading && has_more) {
                    current_page++;
                    comp.loadData();
                }
            };

            return this.render();
        };

        this.buildFilterButton = function () {
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
                                onSelect: function (b) { filter_params.order = b.value; comp.reload(); }
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
                                onSelect: function (b) { filter_params.kind = b.value; comp.reload(); }
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
                                onSelect: function (b) { filter_params.status = b.value; comp.reload(); }
                            });
                        }
                    }
                });
            });
            body.append(filter_btn);
        };

        this.reload = function () {
            body.find('.card').remove();
            body.find('.empty').remove();
            current_page = 1;
            has_more = true;
            this.loadData();
        };

        this.loadData = function () {
            is_loading = true;
            var url = 'https://shikimori.one/api/animes?limit=30&page=' + current_page + '&order=' + filter_params.order;
            if (filter_params.kind) url += '&kind=' + filter_params.kind;
            if (filter_params.status) url += '&status=' + filter_params.status;

            network.silent(url, function(data) {
                if (data && data.length) {
                    comp.build(data);
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

                if (element.score && element.score !== "0.0") {
                    card.find('.card__view').append('<div class="card__vote">' + parseFloat(element.score).toFixed(1) + '</div>');
                }

                // Интеграция с родной базой Lampa (TMDB/CUB)
                card.on('hover:enter', function () {
                    // Включаем крутилку загрузки в центре экрана
                    Lampa.Activity.loader(true); 

                    // Lampa API Search для фонового поиска
                    Lampa.Api.search({
                        query: item.original_title || item.title
                    }, function (search_data) {
                        Lampa.Activity.loader(false);
                        
                        var results = [];
                        // Lampa отдает результаты по категориям (Фильмы, Сериалы), собираем их в один массив
                        if (Array.isArray(search_data)) {
                            search_data.forEach(function (category) {
                                if (category.results && category.results.length) {
                                    results = results.concat(category.results);
                                }
                            });
                        }

                        if (results.length > 0) {
                            var best_match = results[0]; // По умолчанию берем первый результат
                            var target_year = item.release_date ? parseInt(item.release_date.slice(0, 4)) : 0;
                            
                            // Умный поиск: ищем точное совпадение по году, чтобы не перепутать ремейк с оригиналом
                            if (target_year) {
                                for (var i = 0; i < results.length; i++) {
                                    var r_date = results[i].release_date || results[i].first_air_date || '0000';
                                    var r_year = parseInt(r_date.slice(0, 4));
                                    
                                    // Допускаем погрешность в 1 год (т.к. даты релиза в разных базах могут отличаться)
                                    if (r_year === target_year || r_year === target_year - 1 || r_year === target_year + 1) {
                                        best_match = results[i];
                                        break;
                                    }
                                }
                            }

                            // Открываем полноценную страницу (вкладку "full") для найденного фильма/сериала
                            Lampa.Activity.push({
                                component: 'full',
                                movie: best_match,
                                method: best_match.name ? 'tv' : 'movie' 
                            });
                        } else {
                            Lampa.Noty.show('Не удалось найти этот тайтл в основной базе Lampa');
                        }
                    }, function () {
                        Lampa.Activity.loader(false);
                        Lampa.Noty.show('Ошибка поиска в базе Lampa');
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
