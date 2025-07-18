# Техническое задание: Бот для управления героем в Horde Resurrection

## 1. Общее описание

Бот предназначен для автоматического управления героем в игре Horde Resurrection. Бот должен действовать независимо, не учитывая союзников, и фокусироваться исключительно на управлении своим героем.

## 2. Основные функции

### 2.1 Исследование карты и поиск целей
- **Патрулирование**: Бот должен постоянно перемещаться по карте в поисках целей.
- **Поиск зданий**: Приоритетный поиск вражеских строений для их уничтожения.
- **Обнаружение противников**: Сканирование области на предмет вражеских юнитов.
- **Поиск лечения**: Обнаружение дружественных священников при низком здоровье.

### 2.2 Боевая система
- **Анализ силы**: Оценка собственной армии и здоровья перед атакой.
- **Атака зданий**: Приоритетное уничтожение вражеских строений.
- **Бой с противниками**: Атака врагов при благоприятных условиях.
- **Преследование**: Добивание отступающих противников.

### 2.3 Система выживания
- **Мониторинг здоровья**: Постоянный контроль HP героя.
- **Поиск лечения**: Активный поиск священников при низком здоровье.
- **Отступление**: Избегание боя при критическом состоянии.

## 3. Система способностей героев

### 3.1 Анализ применимости способностей
Бот должен анализировать:
- **Тип цели**: Соответствие способности типу цели (юнит/здание/область).
- **Дистанция**: Проверка дальности применения способности.
- **Кулдаун**: Отслеживание времени перезарядки.
- **Мана/ресурсы**: Проверка достаточности ресурсов для применения.
- **Тактическая целесообразность**: Оценка эффективности применения в текущей ситуации.

### 3.2 Логика применения способностей по типам

#### 3.2.1 Атакующие способности
- **Прямой урон** (Fireball, Magic Fire):
  - Применять против сильных одиночных целей.
  - Использовать для добивания раненых противников.
  - Не тратить на слабые цели.

- **Область поражения** (Fire Arrows Rain, Poison Bomb):
  - Применять против скоплений врагов (3+ юнитов).
  - Использовать для зачистки групп слабых противников.
  - Эффективно против зданий с защитниками.

#### 3.2.2 Защитные способности
- **Лечение** (Healing Aura):
  - Использовать при здоровье ниже 50%.
  - Активировать в безопасном месте.
  - Не применять во время активного боя.

#### 3.2.3 Мобильность и утилиты
- **Телепортация** (Teleportation, Teleportation Mark):
  - Использовать для быстрого перемещения к целям.
  - Применять для отступления при критическом здоровье.
  - Устанавливать метки в стратегически важных точках.

- **Невидимость** (Invisibility):
  - Активировать для скрытного подхода к целям.
  - Использовать при отступлении.
  - Применять для разведки.

- **Призыв** (Summon Guardians, Army of Dead):
  - Использовать перед атакой на укрепленные позиции.
  - Применять для отвлечения противника.
  - Активировать при численном превосходстве врага.

#### 3.2.4 Специальные способности
- **Страх** (Fear Attack):
  - Применять против групп слабых противников для их рассеивания.
  - Использовать для прерывания вражеских заклинаний.
- **Огненный рывок** (Fiery Dash):
  - Использовать для быстрого сокращения дистанции с целью.
  - Применять для уклонения от атак.
- **Огненный след** (Fiery Trail):
  - Использовать против преследующих врагов.
  - Применять для блокирования узких проходов.

## 4. Уникальное поведение героев
Для каждого героя должна быть реализована своя логика поведения, учитывающая его уникальные способности и характеристики.

- **Маг огня**: Фокус на использовании атакующих заклинаний с большого расстояния.
- **Воин**: Агрессивный стиль игры, использование способностей для усиления атаки и защиты в ближнем бою.
- **Некромант**: Использование призванных существ для создания численного преимущества.
- **Разбойник**: Скрытные атаки, использование невидимости и телепортации для внезапных ударов.
