# Развёртывание в LXC-контейнере (без docker)

Задание на установку mail-server, subscription-facade и mail-sorter в один
LXC-контейнер (или ВМ) с ALT Linux. Docker не нужен: проекты — обычные
приложения Node.js, работают как службы systemd, веб-интерфейс и страницы
подписки отдаёт nginx.

```
                 nginx :80
   внутренняя сеть ──> mailing.<домен>   ── /api ──> mail-server 127.0.0.1:8000 ──> Redis 127.0.0.1:6379
   интернет ─────────> subscribe.<домен> ── /subscribe, /unsubscribe ──> subscription-facade 127.0.0.1:8001
                                                     mail-server ── SMTP ──> postfix 127.0.0.1:25 ──> получатели
   systemd-таймер (раз в час) ──> mail-sorter ── IMAP ──> ящик noreply@ (внешний почтовый сервер)
```

## 1. Контейнер

- ALT Linux p11 (или Sisyphus): нужны пакеты `node` ≥ 22.23, `npm`, `redis`,
  `nginx`, `postfix`, `git` — в p11 все есть.
- 2 vCPU, 2 ГБ памяти (сборка клиента webpack'ом; в работе хватает 512 МБ),
  10 ГБ диска.
- Обычный непривилегированный контейнер, вложенная виртуализация не нужна.
- Доступ в интернет при установке: пакеты ALT, npm-реестр, GitHub (или GitLab
  eterfund через `REPO_BASE`).
- Входящие соединения — только на 80 (и 443, если HTTPS завершается здесь).

## 2. Исходные данные (заполнить до установки)

| Что | Пример | Куда |
|---|---|---|
| Имя для веб-интерфейса (внутреннее) | `mailing.office.example` | `server_name` первого блока в nginx-конфиге |
| Подсети, из которых доступен интерфейс | `10.0.0.0/8` | `allow` в nginx-конфиге |
| Публичное имя страниц подписки | `subscribe.example.com` | `server_name` второго блока; ссылки в письмах |
| Адрес отправителя рассылок | `noreply@example.com` | `server.mail.from` в `mail-server.json`, `mailer.from` в `mail-sorter.json` |
| Домен для `List-Id` | `example.com` | `server.mail.listIdDomain` |
| Как postfix отправляет почту наружу | relayhost `mail.example.com` или напрямую с SPF/DKIM | `postconf -e relayhost=...` |
| IMAP-ящик для ответов (тот же `noreply@`) | `imap.example.com:993`, логин, пароль | `imapConnection` в `mail-sorter.json`, пароль — `IMAP_PASSWORD` в `mail-sorter.env` |
| Куда пересылать письма от людей | `support@example.com` | `forwardTo` в `mail-sorter.json` |
| Сервис картинок для редактора (если есть) | `https://images.example.com` | `client.imageServiceUrl` в `mail-server.json` |
| HTTPS для страниц подписки | внешний обратный прокси или сертификат здесь | nginx |

## 3. Установка

```
# в контейнере, от root
apt-get update && apt-get install -y git
git clone https://github.com/Etersoft/mail-server.git /root/mail-server
cd /root/mail-server/deploy/lxc
./install.sh --no-start
```

Скрипт ставит пакеты, создаёт пользователя `mailing`, клонирует три проекта в
`/opt/eterfund-mail/`, собирает их, кладёт примеры конфигурации в
`/etc/eterfund-mail/` (в каталоги проектов они подключены символьными ссылками),
устанавливает юниты systemd и сайт nginx, включает журнал AOF в Redis и
ограничивает postfix приёмом писем с localhost.

Затем:

1. Заполнить `/etc/eterfund-mail/mail-server.json`, `mail-sorter.json`,
   `mail-sorter.env` (значения из таблицы выше; описание параметров — в README
   проектов).
2. Поправить `server_name` и `allow` в
   `/etc/nginx/sites-available.d/eterfund-mail.conf`.
3. Настроить отправку почты postfix (relayhost или SPF/DKIM для своего домена).
4. При необходимости поправить шаблоны: письмо подтверждения подписки
   `/etc/eterfund-mail/templates/confirm-subscription.hbs` (ссылка должна вести на
   `https://subscribe.<домен>/subscribe?...`) и страницы
   `/etc/eterfund-mail/templates/subscription-facade/*.hbs`.
5. Запустить установку ещё раз — она пересоберёт клиент с новыми значениями
   `client.*` и запустит службы:

   ```
   ./install.sh
   ```

Другая ветка или тег: `REF=v1.0 ./install.sh`; установка из GitLab eterfund:
`REPO_BASE=git@gitlab.eterfund.ru:eterfund ./install.sh` (нужен SSH-ключ).

## 4. Проверка

```
systemctl status mail-server subscription-facade mail-sorter.timer
curl -s -H 'Host: mailing.office.example' http://127.0.0.1/api/mailings     # {"success":true,...}
curl -s -H 'Host: subscribe.example.com' 'http://127.0.0.1/subscribe?mailingId=1&email=a@b.c&code=x' | grep Ошибка
ss -ltn | grep -E ':(8000|8001|6379) '     # только 127.0.0.1
```

- В веб-интерфейсе создать рассылку на свой адрес, нажать «Отправить пробное
  письмо», затем запустить; письмо должно прийти с заголовком `List-Id`.
- mail-sorter: в `mail-sorter.json` сначала стоит `"readonly": true` — ничего не
  меняется. Запустить вручную и посмотреть журнал:

  ```
  systemctl start mail-sorter && journalctl -u mail-sorter -n 50
  ```

  Если письма классифицируются правильно, поставить `"readonly": false`.

## 5. Эксплуатация

- Обновление: `cd /root/mail-server && git pull && deploy/lxc/install.sh`
  (конфигурация в `/etc/eterfund-mail` не перезаписывается).
- Журналы: `journalctl -u mail-server`, `-u subscription-facade`, `-u mail-sorter`.
- Резервное копирование: все данные рассылок — в Redis, `/var/lib/redis/`
  (AOF и RDB); плюс `/etc/eterfund-mail/`.
- Расписание mail-sorter: `systemctl edit mail-sorter.timer` (`OnCalendar=`).

## 6. Безопасность

- У API mail-server нет аутентификации. Наружу открыты только `/subscribe` и
  `/unsubscribe` на публичном имени; веб-интерфейс ограничен `allow` в nginx,
  mail-server, subscription-facade и Redis слушают только 127.0.0.1.
- При необходимости добавьте на веб-интерфейс базовую аутентификацию nginx
  (`auth_basic`) или доступ только через VPN.
- Службы работают от пользователя `mailing` с `ProtectSystem=strict`.
