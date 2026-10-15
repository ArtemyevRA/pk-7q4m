/* Путь кармы v2 — редакционный контент. Правки текстов — здесь. */
window.KARMA_CONTENT = {
 "schemaVersion": 1,
 "contentVersion": "2026-10-15-v2.1",
 "locale": "ru",
 "audience": "adults",
 "status": "original editorial seed content; review and pilot before public claims",
 "policy": {
  "cardsAreDiagnostic": false,
  "hypothesisRequiresUserSelection": true,
  "allowRejectAll": true,
  "allowUnknown": true,
  "symptomCauseMapping": false,
  "numerologyAffectsMethods": false,
  "rewardLowEmotion": false,
  "mandatoryThreeVisits": false,
  "autoReduceMeasuredIntensityAfterAction": false
 },
 "entryCopy": {
  "promise": "Разберём один повторяющийся сюжет и попробуем отвечать иначе.",
  "cta": "Попробовать",
  "choices": [
   "Есть ситуация",
   "Помоги вспомнить",
   "Сейчас тяжело"
  ],
  "symbolicNote": "Число — символическая тема для размышления. Можно выбрать другую.",
  "emptyMatch": "Эти примеры могут не подходить. Опиши свой случай или пока просто наблюдай."
 },
 "cardInteraction": {
  "maxCardsPerSession": 6,
  "offerSelectionAfterPositiveCards": 2,
  "responses": [
   "Цепляет",
   "Не цепляет",
   "Не уверен"
  ],
  "swipeEquivalentButtons": true,
  "requireRealEpisodeBeforeActivePattern": true,
  "noEpisodeMode": "observe"
 },
 "packs": [
  {
   "id": "refusal",
   "title": "Просьбы и обязательства",
   "cards": [
    {
     "id": "refusal-1",
     "text": "Человек отказывается помочь, и оставшаяся работа достаётся мне.",
     "kind": "memory_prompt"
    },
    {
     "id": "refusal-2",
     "text": "Я соглашаюсь на просьбу, хотя хочу сказать «нет», а потом злюсь.",
     "kind": "memory_prompt"
    },
    {
     "id": "refusal-3",
     "text": "Другой выбирает свои планы, а я снова отменяю собственные.",
     "kind": "memory_prompt"
    },
    {
     "id": "refusal-4",
     "text": "Я помогаю без просьбы и обижаюсь, когда меня не благодарят.",
     "kind": "memory_prompt"
    }
   ],
   "hypotheses": [
    {
     "id": "refusal-h1",
     "branch": "rule",
     "text": "Отказать для меня означает подвести человека.",
     "question": "Если я откажу в небольшой необязательной просьбе, чего боюсь?",
     "innerPermission": "Мои потребности тоже имеют значение.",
     "outerActionExample": "В одной необязательной просьбе сказать: «Сегодня не могу».",
     "exerciseId": "assertive_no",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "refusal-h2",
     "branch": "boundary",
     "text": "Другой не выполняет конкретную договорённость.",
     "question": "О чём мы действительно договорились и что не выполнено?",
     "innerPermission": "Я могу назвать нарушение и ограничить свой вклад.",
     "outerActionExample": "Уточнить договорённость и назвать, что буду делать при её нарушении.",
     "exerciseId": "boundary",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "refusal-h3",
     "branch": "expectation",
     "text": "Я жду взаимности, о которой мы не говорили.",
     "question": "Знает ли человек, какой помощи я ожидаю?",
     "innerPermission": "Я могу попросить прямо и услышать ответ.",
     "outerActionExample": "Сформулировать одну конкретную просьбу вместо ожидания, что догадаются.",
     "exerciseId": "assertive_request",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "refusal-h4",
     "branch": "resource",
     "text": "Я беру на себя больше, чем сейчас могу.",
     "question": "Есть ли у меня силы на это даже при доброжелательном ответе другого?",
     "innerPermission": "Я могу соотносить обязательства со своими силами.",
     "outerActionExample": "Заранее ограничить время или объём помощи.",
     "exerciseId": "resource_step",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "refusal-unknown",
     "branch": "unknown",
     "text": "Пока ни одно объяснение не подходит.",
     "question": "Что можно просто заметить в следующем реальном случае?",
     "innerPermission": "Мне можно пока не знать.",
     "outerActionExample": "Замечу момент и сохраню короткую запись.",
     "exerciseId": "grounding",
     "status": "candidate",
     "requiresConfirmation": true
    }
   ]
  },
  {
   "id": "voice",
   "title": "Разговор и решения",
   "cards": [
    {
     "id": "voice-1",
     "text": "Я начинаю говорить, но меня перебивают и меняют тему.",
     "kind": "memory_prompt"
    },
    {
     "id": "voice-2",
     "text": "На встрече принимают решение, не спросив моего мнения.",
     "kind": "memory_prompt"
    },
    {
     "id": "voice-3",
     "text": "Я молчу о несогласии, а потом долго прокручиваю разговор.",
     "kind": "memory_prompt"
    },
    {
     "id": "voice-4",
     "text": "Мне отвечают «не усложняй», когда я объясняю важное для себя.",
     "kind": "memory_prompt"
    }
   ],
   "hypotheses": [
    {
     "id": "voice-h1",
     "branch": "rule",
     "text": "Я запрещаю себе занимать время и пространство.",
     "question": "Что, по моему ожиданию, случится, если я спокойно закончу мысль?",
     "innerPermission": "Я могу быть услышан, даже если со мной не согласны.",
     "outerActionExample": "Сказать: «Я закончу мысль, потом послушаю тебя».",
     "exerciseId": "assertive_request",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "voice-h2",
     "branch": "boundary",
     "text": "В разговоре нарушается моя граница.",
     "question": "Могу ли я назвать конкретное действие без оценки личности?",
     "innerPermission": "Я могу обозначить формат разговора или остановить его.",
     "outerActionExample": "Обозначить просьбу не перебивать; при повторении перенести разговор.",
     "exerciseId": "boundary",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "voice-h3",
     "branch": "expectation",
     "text": "Я читаю перебивание как доказательство своей неважности.",
     "question": "Какие факты подтверждают и какие не подтверждают эту версию?",
     "innerPermission": "Я могу проверить смысл, прежде чем делать вывод о себе.",
     "outerActionExample": "Уточнить: «Ты хочешь закончить мою мысль или перейти к другой теме?»",
     "exerciseId": "thought_check",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "voice-h4",
     "branch": "own_behavior",
     "text": "Иногда я тоже перестаю слушать, когда волнуюсь.",
     "question": "Есть ли конкретный случай, когда это сделал я, или это не про меня?",
     "innerPermission": "Я могу менять свою часть общения без оправдания чужой.",
     "outerActionExample": "В одном разговоре сначала пересказать услышанное, потом ответить.",
     "exerciseId": "if_then",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "voice-unknown",
     "branch": "unknown",
     "text": "Пока ни одно объяснение не подходит.",
     "question": "Что можно просто заметить в следующем реальном случае?",
     "innerPermission": "Мне можно пока не знать.",
     "outerActionExample": "Замечу момент и сохраню короткую запись.",
     "exerciseId": "grounding",
     "status": "candidate",
     "requiresConfirmation": true
    }
   ]
  },
  {
   "id": "criticism",
   "title": "Замечания и оценка",
   "cards": [
    {
     "id": "criticism-1",
     "text": "Мне указывают на ошибку при других людях.",
     "kind": "memory_prompt"
    },
    {
     "id": "criticism-2",
     "text": "После одного замечания я думаю, что всё сделал плохо.",
     "kind": "memory_prompt"
    },
    {
     "id": "criticism-3",
     "text": "Кто-то поправляет небольшую деталь, и я начинаю оправдываться.",
     "kind": "memory_prompt"
    },
    {
     "id": "criticism-4",
     "text": "Я хочу показать результат, но откладываю из страха оценки.",
     "kind": "memory_prompt"
    }
   ],
   "hypotheses": [
    {
     "id": "criticism-h1",
     "branch": "rule",
     "text": "Ошибка для меня означает, что я недостаточно хорош.",
     "question": "Что я заключаю о себе из одной ошибки?",
     "innerPermission": "Я могу ошибаться и оставаться достойным уважения.",
     "outerActionExample": "Показать достаточно готовый результат в малорисковой задаче.",
     "exerciseId": "rule_permission",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "criticism-h2",
     "branch": "boundary",
     "text": "Форма замечания унизительна или неуместна.",
     "question": "Что именно в форме общения неприемлемо?",
     "innerPermission": "Я могу обсуждать ошибку и не соглашаться с унижением.",
     "outerActionExample": "Попросить обсуждать замечания конкретно и без публичного унижения.",
     "exerciseId": "boundary",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "criticism-h3",
     "branch": "expectation",
     "text": "Я предполагаю негативную оценку шире, чем услышал.",
     "question": "Что сказали дословно и что я достроил?",
     "innerPermission": "Я могу проверить замечание, не обобщая его на всё.",
     "outerActionExample": "Спросить, что именно нужно изменить и что уже подходит.",
     "exerciseId": "thought_check",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "criticism-h4",
     "branch": "resource",
     "text": "Я особенно чувствителен к замечаниям, когда истощён.",
     "question": "Отличается ли реакция после отдыха и при перегрузке?",
     "innerPermission": "Я могу отложить обсуждение, чтобы вернуться к нему с ресурсом.",
     "outerActionExample": "Назначить время обратной связи после паузы.",
     "exerciseId": "resource_step",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "criticism-unknown",
     "branch": "unknown",
     "text": "Пока ни одно объяснение не подходит.",
     "question": "Что можно просто заметить в следующем реальном случае?",
     "innerPermission": "Мне можно пока не знать.",
     "outerActionExample": "Замечу момент и сохраню короткую запись.",
     "exerciseId": "grounding",
     "status": "candidate",
     "requiresConfirmation": true
    }
   ]
  },
  {
   "id": "control",
   "title": "Контроль и самостоятельность",
   "cards": [
    {
     "id": "control-1",
     "text": "Другой делает задачу по-своему, и я хочу переделать.",
     "kind": "memory_prompt"
    },
    {
     "id": "control-2",
     "text": "Планы меняются, и мне трудно переключиться.",
     "kind": "memory_prompt"
    },
    {
     "id": "control-3",
     "text": "Я делегирую, но постоянно проверяю каждый шаг.",
     "kind": "memory_prompt"
    },
    {
     "id": "control-4",
     "text": "Кто-то требует от меня делать только его способом.",
     "kind": "memory_prompt"
    }
   ],
   "hypotheses": [
    {
     "id": "control-h1",
     "branch": "rule",
     "text": "Без моего контроля обязательно случится плохое.",
     "question": "Какой конкретный исход я предсказываю, если не проверю одну мелочь?",
     "innerPermission": "Я могу пробовать ограниченное доверие в безопасных задачах.",
     "outerActionExample": "Оставить одну малорисковую часть работы без промежуточной проверки.",
     "exerciseId": "behavior_experiment",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "control-h2",
     "branch": "boundary",
     "text": "Другой ограничивает мою самостоятельность.",
     "question": "Где нужны согласованные требования, а где мне нужен выбор способа?",
     "innerPermission": "Я могу обсуждать границы своей ответственности.",
     "outerActionExample": "Согласовать результат и предложить самому выбрать способ выполнения.",
     "exerciseId": "boundary",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "control-h3",
     "branch": "expectation",
     "text": "Мой привычный способ кажется единственно правильным.",
     "question": "Может ли другой способ дать приемлемый результат?",
     "innerPermission": "Я могу отличать предпочтение от требования.",
     "outerActionExample": "Заранее определить один критерий приемлемого результата.",
     "exerciseId": "thought_check",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "control-h4",
     "branch": "resource",
     "text": "Изменения особенно тяжело даются при перегрузке.",
     "question": "Какая часть нагрузки мешает сейчас переключиться?",
     "innerPermission": "Мне можно уменьшить число задач.",
     "outerActionExample": "Убрать или перенести одну необязательную задачу.",
     "exerciseId": "resource_step",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "control-unknown",
     "branch": "unknown",
     "text": "Пока ни одно объяснение не подходит.",
     "question": "Что можно просто заметить в следующем реальном случае?",
     "innerPermission": "Мне можно пока не знать.",
     "outerActionExample": "Замечу момент и сохраню короткую запись.",
     "exerciseId": "grounding",
     "status": "candidate",
     "requiresConfirmation": true
    }
   ]
  },
  {
   "id": "rest",
   "title": "Работа и отдых",
   "cards": [
    {
     "id": "rest-1",
     "text": "Другой отдыхает, пока я продолжаю работать, и меня это злит.",
     "kind": "memory_prompt"
    },
    {
     "id": "rest-2",
     "text": "После отдыха мне кажется, что я зря потратил время.",
     "kind": "memory_prompt"
    },
    {
     "id": "rest-3",
     "text": "Я замечаю чужую лёгкость и думаю, что себе так нельзя.",
     "kind": "memory_prompt"
    },
    {
     "id": "rest-4",
     "text": "Я берусь за задачу автоматически, хотя уже устал.",
     "kind": "memory_prompt"
    }
   ],
   "hypotheses": [
    {
     "id": "rest-h1",
     "branch": "rule",
     "text": "Отдых надо заслужить идеальным выполнением всех дел.",
     "question": "Когда по этому правилу мне вообще разрешён отдых?",
     "innerPermission": "Я могу отдыхать до полного истощения.",
     "outerActionExample": "Сделать короткий заранее запланированный перерыв.",
     "exerciseId": "rule_permission",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "rest-h2",
     "branch": "boundary",
     "text": "Обязанности реально распределены неравномерно.",
     "question": "Какую договорённость о распределении можно проверить?",
     "innerPermission": "Я могу обсуждать справедливый вклад.",
     "outerActionExample": "Назвать одну задачу, которую нужно распределить заново.",
     "exerciseId": "assertive_request",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "rest-h3",
     "branch": "expectation",
     "text": "По одному эпизоду я заключаю, что другой вообще ничего не делает.",
     "question": "Что я знаю о его вкладе, а чего не знаю?",
     "innerPermission": "Я могу уточнить картину без отмены своих потребностей.",
     "outerActionExample": "Сверить конкретные задачи и время, а не спорить о «лени».",
     "exerciseId": "thought_check",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "rest-h4",
     "branch": "resource",
     "text": "Я уже истощён и нуждаюсь в восстановлении.",
     "question": "Что сейчас даст минимальное посильное облегчение?",
     "innerPermission": "Мне можно признать предел сил.",
     "outerActionExample": "Сократить сегодняшнюю нагрузку на один выполнимый пункт.",
     "exerciseId": "resource_step",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "rest-unknown",
     "branch": "unknown",
     "text": "Пока ни одно объяснение не подходит.",
     "question": "Что можно просто заметить в следующем реальном случае?",
     "innerPermission": "Мне можно пока не знать.",
     "outerActionExample": "Замечу момент и сохраню короткую запись.",
     "exerciseId": "grounding",
     "status": "candidate",
     "requiresConfirmation": true
    }
   ]
  },
  {
   "id": "uncertainty",
   "title": "Молчание и неопределённость",
   "cards": [
    {
     "id": "uncertainty-1",
     "text": "На моё сообщение долго не отвечают, и я снова проверяю телефон.",
     "kind": "memory_prompt"
    },
    {
     "id": "uncertainty-2",
     "text": "Я не знаю, что другой думает обо мне, и начинаю додумывать.",
     "kind": "memory_prompt"
    },
    {
     "id": "uncertainty-3",
     "text": "Разговор обрывается без объяснения, и я не могу заняться своим.",
     "kind": "memory_prompt"
    },
    {
     "id": "uncertainty-4",
     "text": "Я хочу уточнить договорённость, но боюсь показаться навязчивым.",
     "kind": "memory_prompt"
    }
   ],
   "hypotheses": [
    {
     "id": "uncertainty-h1",
     "branch": "expectation",
     "text": "Молчание я читаю как отказ или отвержение.",
     "question": "Какие ещё объяснения есть и что можно уточнить?",
     "innerPermission": "Я могу не знать чужую мысль и проверить факты.",
     "outerActionExample": "Один раз уточнить нужную информацию конкретным сообщением.",
     "exerciseId": "thought_check",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "uncertainty-h2",
     "branch": "rule",
     "text": "Я запрещаю себе прямо просить ясности.",
     "question": "Чего боюсь, если задам один понятный вопрос?",
     "innerPermission": "Я могу просить ясности, не требуя немедленного ответа.",
     "outerActionExample": "Задать вопрос и обозначить удобный срок ответа.",
     "exerciseId": "assertive_request",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "uncertainty-h3",
     "branch": "boundary",
     "text": "Другой нарушает согласованный срок или условие.",
     "question": "Был ли срок действительно согласован?",
     "innerPermission": "Я могу строить свои решения с учётом отсутствия ответа.",
     "outerActionExample": "Назвать срок, после которого выберу своё дальнейшее действие.",
     "exerciseId": "boundary",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "uncertainty-h4",
     "branch": "resource",
     "text": "Я застреваю в проверках, когда мне трудно переключиться.",
     "question": "Какое своё небольшое дело могу сделать до следующей проверки?",
     "innerPermission": "Мне можно возвращаться к своей жизни при неопределённости.",
     "outerActionExample": "Отложить одну проверку телефона и сделать выбранное короткое дело.",
     "exerciseId": "grounding",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "uncertainty-unknown",
     "branch": "unknown",
     "text": "Пока ни одно объяснение не подходит.",
     "question": "Что можно просто заметить в следующем реальном случае?",
     "innerPermission": "Мне можно пока не знать.",
     "outerActionExample": "Замечу момент и сохраню короткую запись.",
     "exerciseId": "grounding",
     "status": "candidate",
     "requiresConfirmation": true
    }
   ]
  },
  {
   "id": "fairness",
   "title": "Вклад и справедливость",
   "cards": [
    {
     "id": "fairness-1",
     "text": "Я делаю дополнительную работу, а её считают само собой разумеющейся.",
     "kind": "memory_prompt"
    },
    {
     "id": "fairness-2",
     "text": "Мы распределяем расходы, но условия остаются неясными.",
     "kind": "memory_prompt"
    },
    {
     "id": "fairness-3",
     "text": "Другому разрешено то, за что меня критикуют.",
     "kind": "memory_prompt"
    },
    {
     "id": "fairness-4",
     "text": "Я жду признания вклада и молчу о своих условиях.",
     "kind": "memory_prompt"
    }
   ],
   "hypotheses": [
    {
     "id": "fairness-h1",
     "branch": "boundary",
     "text": "Мои условия или договорённости не соблюдаются.",
     "question": "Какие наблюдаемые условия можно обсудить?",
     "innerPermission": "Я могу назвать свои условия и выбрать участие.",
     "outerActionExample": "До следующего вклада согласовать объём, срок или оплату.",
     "exerciseId": "boundary",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "fairness-h2",
     "branch": "rule",
     "text": "Я запрещаю себе просить признания или обсуждать деньги.",
     "question": "Что плохого, по моей версии, означает такая просьба?",
     "innerPermission": "Я могу обсуждать вклад и оплату уважительно.",
     "outerActionExample": "Сформулировать один конкретный вопрос о своём вкладе.",
     "exerciseId": "assertive_request",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "fairness-h3",
     "branch": "expectation",
     "text": "Я ожидаю, что мой вклад заметят без обсуждения.",
     "question": "Что человек действительно знает о моих усилиях и ожиданиях?",
     "innerPermission": "Я могу сделать ожидание явным.",
     "outerActionExample": "Описать вклад фактами и попросить обратную связь.",
     "exerciseId": "thought_check",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "fairness-h4",
     "branch": "resource",
     "text": "Я продолжаю вкладываться сверх своих возможностей.",
     "question": "Какой предел я могу установить независимо от чужой благодарности?",
     "innerPermission": "Я могу ограничить необязательный вклад.",
     "outerActionExample": "Определить посильный предел времени или расходов без финансовых советов.",
     "exerciseId": "resource_step",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "fairness-unknown",
     "branch": "unknown",
     "text": "Пока ни одно объяснение не подходит.",
     "question": "Что можно просто заметить в следующем реальном случае?",
     "innerPermission": "Мне можно пока не знать.",
     "outerActionExample": "Замечу момент и сохраню короткую запись.",
     "exerciseId": "grounding",
     "status": "candidate",
     "requiresConfirmation": true
    }
   ]
  },
  {
   "id": "closeness",
   "title": "Близость и внимание",
   "cards": [
    {
     "id": "closeness-1",
     "text": "Близкий смотрит в телефон, когда я хочу поговорить.",
     "kind": "memory_prompt"
    },
    {
     "id": "closeness-2",
     "text": "Я хочу внимания, но вместо просьбы отдаляюсь.",
     "kind": "memory_prompt"
    },
    {
     "id": "closeness-3",
     "text": "Другой не догадался, что мне нужна поддержка, и я обижаюсь.",
     "kind": "memory_prompt"
    },
    {
     "id": "closeness-4",
     "text": "Мне предлагают помощь, но я отказываюсь и потом чувствую одиночество.",
     "kind": "memory_prompt"
    }
   ],
   "hypotheses": [
    {
     "id": "closeness-h1",
     "branch": "rule",
     "text": "Просить поддержку для меня означает быть слабым или неудобным.",
     "question": "Что я боюсь услышать в ответ на конкретную просьбу?",
     "innerPermission": "Мне можно нуждаться в поддержке.",
     "outerActionExample": "Попросить о небольшой конкретной помощи у подходящего человека.",
     "exerciseId": "assertive_request",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "closeness-h2",
     "branch": "boundary",
     "text": "Моя просьба или согласованный разговор игнорируется.",
     "question": "Были ли согласованы время и формат внимания?",
     "innerPermission": "Я могу обсуждать качество контакта и выбирать дистанцию.",
     "outerActionExample": "Согласовать короткий разговор без отвлечений или перенести его.",
     "exerciseId": "boundary",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "closeness-h3",
     "branch": "expectation",
     "text": "Я жду, что человек поймёт потребность без слов.",
     "question": "Я уже сказал, какая поддержка мне нужна?",
     "innerPermission": "Я могу объяснять потребность прямо.",
     "outerActionExample": "Назвать, нужна ли сейчас помощь, совет или просто выслушивание.",
     "exerciseId": "thought_check",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "closeness-h4",
     "branch": "own_behavior",
     "text": "Иногда я сам закрываю возможность получить поддержку.",
     "question": "Есть ли пример, когда я отказался, хотя хотел принять?",
     "innerPermission": "Я могу выбирать, какую поддержку принять.",
     "outerActionExample": "Принять одну подходящую небольшую помощь.",
     "exerciseId": "behavior_experiment",
     "status": "candidate",
     "requiresConfirmation": true
    },
    {
     "id": "closeness-unknown",
     "branch": "unknown",
     "text": "Пока ни одно объяснение не подходит.",
     "question": "Что можно просто заметить в следующем реальном случае?",
     "innerPermission": "Мне можно пока не знать.",
     "outerActionExample": "Замечу момент и сохраню короткую запись.",
     "exerciseId": "grounding",
     "status": "candidate",
     "requiresConfirmation": true
    }
   ]
  }
 ],
 "exercises": [
  {
   "id": "grounding",
   "title": "Вернуть опору",
   "targetSeconds": 45,
   "sourceId": "who_stress",
   "steps": [
    "Почувствуй удобную опору ног или спины. Можно оставить глаза открытыми.",
    "Назови три предмета вокруг.",
    "Заметь: «Сейчас я чувствую…». Не нужно убирать чувство.",
    "Выбери ближайшее посильное действие."
   ],
   "limits": [
    "Становится неприятнее — закончить, переключиться на другой способ поддержки."
   ],
   "reflection": "Мне немного легче / так же / тяжелее / не хочу оценивать",
   "canStopAnytime": true,
   "requiresText": false
  },
  {
   "id": "thought_check",
   "title": "Проверить версию",
   "targetSeconds": 90,
   "sourceId": "nhs_thought_record",
   "steps": [
    "Что произошло, если описать это как запись камеры?",
    "Какой вывод я сделал?",
    "Какой факт поддерживает этот вывод? Какой не подходит к нему?",
    "Есть ли более точная версия, которая учитывает оба?"
   ],
   "limits": [
    "«Пока не знаю» допустимо; не искать обязательный позитивный вывод."
   ],
   "reflection": "Какое действие следует из уточнённой версии?",
   "canStopAnytime": true,
   "requiresText": false
  },
  {
   "id": "rule_permission",
   "title": "Ослабить жёсткое правило",
   "targetSeconds": 90,
   "sourceId": "cci_perfectionism",
   "steps": [
    "Заверши: «Если я позволю себе…, боюсь, что…».",
    "Как это правило помогает и какой ценой?",
    "Сформулируй более гибкое разрешение, сохраняя уважение к другим.",
    "Выбери маленький случай, где можно его попробовать."
   ],
   "limits": [
    "Разрешение не оправдывает причинение вреда или нарушение договорённостей."
   ],
   "reflection": "Какой наблюдаемый результат проверит моё ожидание?",
   "canStopAnytime": true,
   "requiresText": false
  },
  {
   "id": "assertive_no",
   "title": "Отказ без самоподавления",
   "targetSeconds": 45,
   "sourceId": "cci_assertiveness",
   "steps": [
    "Выбери небольшую необязательную просьбу, от которой можешь отказаться.",
    "Сформулируй коротко: «Сегодня не могу». Можно добавить подходящую альтернативу, но это необязательно.",
    "Если уместно, повтори позицию спокойно, не увеличивая оправдания.",
    "После отметь реальный ответ и что происходило с тобой."
   ],
   "limits": [
    "Не использовать как автоматическое предписание в небезопасном контакте."
   ],
   "reflection": "Получилось выбрать ответ / частично / не было повода / нужен другой шаг",
   "canStopAnytime": true,
   "requiresText": false
  },
  {
   "id": "assertive_request",
   "title": "Прямая просьба",
   "targetSeconds": 45,
   "sourceId": "cci_assertiveness",
   "steps": [
    "Назови наблюдаемое событие без ярлыка личности.",
    "Назови, что тебе нужно в этой ситуации.",
    "Попроси одно конкретное действие.",
    "Узнай ответ; другой может не согласиться. Выбери свою следующую границу."
   ],
   "limits": [
    "Отказ другого не означает, что просьба была неправильной."
   ],
   "reflection": "Что стало яснее после просьбы?",
   "canStopAnytime": true,
   "requiresText": false
  },
  {
   "id": "boundary",
   "title": "Граница моего участия",
   "targetSeconds": 60,
   "sourceId": "cci_assertiveness",
   "steps": [
    "Что конкретно для меня неприемлемо?",
    "Что я могу сделать сам, если это продолжится?",
    "Сформулируй просьбу и свою границу: «Если разговор продолжится в таком тоне, я прерву его и вернусь позже».",
    "Выбери реалистичное действие и проверь последствия."
   ],
   "limits": [
    "Не угроза и не способ заставить другого измениться; безопасность важнее обязательного разговора."
   ],
   "reflection": "Моя граница помогла / не помогла / последствия требуют другого решения",
   "canStopAnytime": true,
   "requiresText": false
  },
  {
   "id": "behavior_experiment",
   "title": "Маленькая проверка",
   "targetSeconds": 90,
   "sourceId": "cci_perfectionism",
   "steps": [
    "Что я предсказываю, если сделаю иначе?",
    "Какой маленький обратимый шаг я могу попробовать?",
    "Что буду наблюдать, чтобы отличить ожидание от факта?",
    "После шага: что случилось и что нужно уточнить?"
   ],
   "limits": [
    "Не провоцировать опасность или конфликт ради эксперимента. Один результат не доказывает правило для всех ситуаций."
   ],
   "reflection": "Ожидание подтвердилось / частично / не подтвердилось / данных недостаточно",
   "canStopAnytime": true,
   "requiresText": false
  },
  {
   "id": "if_then",
   "title": "План на момент",
   "targetSeconds": 30,
   "sourceId": "implementation_intentions",
   "steps": [
    "Выбери узнаваемый внешний или телесный сигнал.",
    "Выбери одно короткое выполнимое действие.",
    "Запиши: «Если …, то я …».",
    "Оставь план на главном экране; после реального повода отметь, сработал ли."
   ],
   "limits": [
    "План зависит от возможностей и контекста; его можно менять."
   ],
   "reflection": "При каком сигнале мне удалось вспомнить шаг?",
   "canStopAnytime": true,
   "requiresText": false
  },
  {
   "id": "resource_step",
   "title": "Уменьшить нагрузку",
   "targetSeconds": 45,
   "sourceId": "who_stress",
   "steps": [
    "Назови, чего сейчас не хватает: отдыха, времени, помощи или ясности.",
    "Выбери один пункт, который можно уменьшить, перенести или разделить.",
    "Сделай конкретную просьбу или изменение плана.",
    "Отметь, как это повлияло на возможность заниматься своими делами."
   ],
   "limits": [
    "Не трактовать перегрузку как личную неисправность."
   ],
   "reflection": "Стало посильнее / так же / труднее / пока не знаю",
   "canStopAnytime": true,
   "requiresText": false
  }
 ],
 "firstWeekModules": [
  {
   "id": "episode",
   "suggestedDay": 1,
   "title": "Один случай",
   "lead": "Что произошло и что я обычно делаю?",
   "fields": [
    "Наблюдаемое событие",
    "Основная эмоция",
    "Интенсивность 0–10",
    "Мой привычный ответ"
   ],
   "resultCopy": "Пока замечаю момент и даю себе паузу.",
   "sourceId": "nhs_thought_record",
   "allowUnknown": true,
   "canDefer": true
  },
  {
   "id": "meaning",
   "suggestedDay": 2,
   "title": "Что это для меня значит",
   "lead": "В тот момент мне показалось…",
   "fields": [
    "Выбрать или написать первую мысль",
    "Это наблюдение или моя версия?"
   ],
   "resultCopy": "Моя первая мысль — версия, которую можно проверить.",
   "sourceId": "nhs_thought_record",
   "allowUnknown": true,
   "canDefer": true
  },
  {
   "id": "need",
   "suggestedDay": 3,
   "title": "Чего мне не хватило",
   "lead": "Что в этой ситуации было важно для меня?",
   "fields": [
    "Потребность: уважение / ясность / отдых / выбор / поддержка / справедливость / другое / не знаю",
    "Одно возможное объяснение из карточек или своё"
   ],
   "resultCopy": "Проверяем одно объяснение, не назначаем окончательную причину.",
   "sourceId": "cci_assertiveness",
   "allowUnknown": true,
   "canDefer": true
  },
  {
   "id": "rule",
   "suggestedDay": 4,
   "title": "Что я себе разрешаю",
   "lead": "Если я позволю себе…, боюсь, что…",
   "fields": [
    "Внутреннее правило или вариант «это про границу / ресурс / пока не знаю»",
    "Более гибкое разрешение или конкретная граница"
   ],
   "resultCopy": "Одно внутреннее разрешение и один внешний шаг.",
   "sourceId": "cci_perfectionism",
   "allowUnknown": true,
   "canDefer": true
  },
  {
   "id": "experiment",
   "suggestedDay": 5,
   "title": "Проверить действием",
   "lead": "Что я ожидаю и что реально случится?",
   "fields": [
    "Предсказание",
    "Маленькое действие",
    "Наблюдаемый результат"
   ],
   "resultCopy": "Если будет повод — проверю выбранный шаг.",
   "sourceId": "cci_perfectionism",
   "allowUnknown": true,
   "canDefer": true
  },
  {
   "id": "transfer",
   "suggestedDay": 6,
   "title": "Похожий сюжет",
   "lead": "Это та же мысль или просто похожая эмоция?",
   "fields": [
    "Новый реальный случай или «не было»",
    "Связь с текущим правилом: да / нет / не знаю"
   ],
   "resultCopy": "Уточняю свой сюжет, не собираю все раздражители в один.",
   "sourceId": "nhs_thought_record",
   "allowUnknown": true,
   "canDefer": true
  },
  {
   "id": "review",
   "suggestedDay": 7,
   "title": "Что я узнал",
   "lead": "Что помогло, а что не подтвердилось?",
   "fields": [
    "Подтвердить реальные события",
    "Оценить гипотезу",
    "Выбрать следующий шаг"
   ],
   "resultCopy": "Продолжить / упростить / изменить гипотезу / наблюдать / пауза.",
   "sourceId": "cci_perfectionism",
   "allowUnknown": true,
   "canDefer": true
  }
 ],
 "bodyObservation": {
  "optional": true,
  "locations": [
   "Челюсть",
   "Плечи",
   "Горло",
   "Грудь",
   "Живот",
   "Голова",
   "Всё тело",
   "Ничего заметного",
   "Другое",
   "Не хочу обращать внимание на тело"
  ],
  "sensations": [
   "Напряжение",
   "Тяжесть",
   "Жар",
   "Дрожь",
   "Боль",
   "Другое",
   "Не знаю"
  ],
  "message": "Это наблюдение за ощущением, а не определение причины болезни.",
  "planTemplate": "Если замечаю {signal}, то сначала {chosenAction}.",
  "correlationCopy": "В твоих записях {a} и {b} встречались вместе в {n} случаях. Это не доказывает причину.",
  "medicalCopy": "Новый, выраженный, нарастающий или стойкий симптом стоит обсудить с врачом. Не нужно ждать окончания трека.",
  "sourceId": "nhs_body"
 },
 "emotions": {
  "primary": [
   "Злость",
   "Обида",
   "Тревога",
   "Грусть",
   "Стыд",
   "Растерянность",
   "Другое",
   "Не знаю"
  ],
  "optionalDetails": {
   "Злость": [
    "Раздражение",
    "Возмущение",
    "Досада"
   ],
   "Обида": [
    "Мне больно",
    "Чувствую себя незамеченным",
    "Чувствую несправедливость"
   ],
   "Тревога": [
    "Беспокойство",
    "Страх",
    "Неуверенность"
   ]
  },
  "instruction": "Выбери ближайшее слово. Можно ошибиться или уточнить позже."
 },
 "daily": {
  "morningMaxSeconds": 30,
  "eventMaxSeconds": 20,
  "eveningMaxSeconds": 90,
  "defaultReminders": [
   "evening"
  ],
  "opportunity": [
   "Был повод",
   "Не было повода",
   "Не уверен"
  ],
  "actionResult": [
   "Получилось",
   "Частично",
   "Не получилось",
   "Выбрал другое"
  ],
  "changeObservation": [
   "Лучше",
   "Без изменений",
   "Труднее",
   "Не знаю"
  ],
  "eventIntensityScale": {
   "min": 0,
   "max": 10,
   "label": "Насколько сильно задело?"
  },
  "eveningImpactScale": {
   "min": 0,
   "max": 10,
   "label": "Насколько трудно сейчас возвращаться к своим делам и выбранному поведению?"
  },
  "quickEvening": {
   "targetSeconds": 30,
   "fields": [
    "currentImpact",
    "actionStatus"
   ]
  },
  "unknownIsNotZero": true
 },
 "progressPolicy": {
  "status": "pilot heuristic, not clinical criterion",
  "minElapsedCalendarDays": 21,
  "stabilityWindowCount": 2,
  "stabilityWindowDays": 7,
  "minImpactRatingsPerWindow": 4,
  "maxEachRecordedImpact": 2,
  "minRealOpportunitiesPerWindow": 1,
  "minConfirmedActionsAcrossWindowsOnDistinctDays": 3,
  "countRehearsalsAsReal": false,
  "flagChecks": [
   "Я выбирал ответ, а не только подавлял себя.",
   "Это не требует терпеть нарушение моих границ.",
   "Я вижу, в каких случаях навык помогает."
  ],
  "lowWeeklySummaryAloneIsEnough": false,
  "measuredStateChangesOnlyByUserRating": true,
  "maxPracticeStepsPerDay": 1,
  "preserveFlagsOnRecurrence": true,
  "clarityBasis": "unique skill flags only"
 },
 "sources": [
  {
   "id": "nhs_thought_record",
   "title": "NHS: Thought record",
   "url": "https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/self-help-cbt-techniques/thought-record/",
   "use": "method basis; adapted exercises are not validated as this product"
  },
  {
   "id": "cci_assertiveness",
   "title": "CCI: Assertiveness",
   "url": "https://www.cci.health.wa.gov.au/en/Resources/Looking-After-Yourself/Assertiveness",
   "use": "method basis; adapted exercises are not validated as this product"
  },
  {
   "id": "cci_perfectionism",
   "title": "CCI: Perfectionism",
   "url": "https://www.cci.health.wa.gov.au/Resources/Looking-After-Yourself/Perfectionism",
   "use": "method basis; adapted exercises are not validated as this product"
  },
  {
   "id": "who_stress",
   "title": "WHO: Doing What Matters",
   "url": "https://www.who.int/thailand/activities/doing-what-matters-in-times-of-stress",
   "use": "method basis; adapted exercises are not validated as this product"
  },
  {
   "id": "implementation_intentions",
   "title": "Gollwitzer & Sheeran, 2006",
   "url": "https://doi.org/10.1016/S0065-2601(06)38002-1",
   "use": "method basis; adapted exercises are not validated as this product"
  },
  {
   "id": "nhs_body",
   "title": "NHS: Stress",
   "url": "https://www.nhs.uk/every-mind-matters/mental-health-issues/stress/",
   "use": "method basis; adapted exercises are not validated as this product"
  }
 ],
 "extra": {
  "skills": [
   {
    "id": "need",
    "label": "Говорю о своей потребности",
    "short": "Просьба"
   },
   {
    "id": "refuse",
    "label": "Могу отказать",
    "short": "Отказ"
   },
   {
    "id": "pause",
    "label": "Делаю паузу",
    "short": "Пауза"
   },
   {
    "id": "boundary",
    "label": "Обозначаю границу",
    "short": "Граница"
   },
   {
    "id": "goodenough",
    "label": "Допускаю достаточно хороший результат",
    "short": "Достаточно"
   },
   {
    "id": "uncertainty",
    "label": "Выдерживаю неопределённость",
    "short": "Неопределённость"
   }
  ],
  "exerciseSkill": {
   "grounding": "pause",
   "if_then": "pause",
   "thought_check": "uncertainty",
   "rule_permission": "goodenough",
   "assertive_no": "refuse",
   "assertive_request": "need",
   "boundary": "boundary",
   "behavior_experiment": "goodenough",
   "resource_step": "boundary"
  },
  "actionTypes": [
   {
    "id": "pause",
    "label": "Пауза",
    "skill": "pause"
   },
   {
    "id": "request",
    "label": "Просьба",
    "skill": "need"
   },
   {
    "id": "refuse",
    "label": "Отказ",
    "skill": "refuse"
   },
   {
    "id": "boundary",
    "label": "Граница",
    "skill": "boundary"
   },
   {
    "id": "experiment",
    "label": "Мой эксперимент",
    "skill": null
   },
   {
    "id": "other",
    "label": "Другое",
    "skill": null
   }
  ],
  "pauseCheck": {
   "q": "Это была выбранная пауза или было страшно сказать?",
   "opts": [
    [
     "chosen",
     "Выбранная пауза"
    ],
    [
     "scared",
     "Было страшно сказать"
    ],
    [
     "unknown",
     "Не знаю"
    ]
   ]
  },
  "quickEvents": [
   "Меня перебили и сменили тему",
   "Мне отказали в помощи, и всё осталось на мне",
   "Меня поправили при других",
   "На меня переложили чужую работу",
   "Мне долго не отвечают",
   "Близкий смотрит в телефон, когда я говорю",
   "Решение приняли, не спросив меня"
  ],
  "people": [
   "коллега",
   "руководитель",
   "партнёр",
   "близкий",
   "родитель",
   "ребёнок",
   "друг",
   "ситуация"
  ],
  "habitualResponses": [
   "Промолчал и сделал сам",
   "Согласился, хотя не хотел",
   "Спорил и доказывал",
   "Ушёл и закрылся",
   "Объяснялся и оправдывался",
   "Сорвался",
   "Другое",
   "Не знаю"
  ],
  "firstPlans": [
   {
    "id": "pause",
    "text": "Когда заденет, замечу реакцию и возьму короткую паузу перед ответом",
    "skill": "pause",
    "signal": "заденет",
    "action": "замечу реакцию и возьму короткую паузу"
   },
   {
    "id": "need",
    "text": "Скажу, что мне нужно",
    "skill": "need",
    "signal": "заденет",
    "action": "скажу одной фразой, что мне нужно"
   },
   {
    "id": "observe",
    "text": "Пока только наблюдаю",
    "skill": null,
    "signal": "заденет",
    "action": "замечу момент и сохраню короткую запись"
   }
  ],
  "firstThoughts": [
   "Опять всё на мне",
   "Меня не ценят",
   "Со мной не считаются",
   "Я не нужен",
   "Так нельзя",
   "Я подвёл",
   "Я должен справиться сам",
   "Меня не слышат"
  ],
  "observationOrVersion": [
   [
    "observation",
    "Это наблюдение: так было на самом деле"
   ],
   [
    "version",
    "Это моя версия: так мне показалось"
   ],
   [
    "unknown",
    "Не знаю"
   ]
  ],
  "needs": [
   "Уважение",
   "Ясность",
   "Отдых",
   "Выбор",
   "Поддержка",
   "Справедливость",
   "Другое",
   "Не знаю"
  ],
  "fears": [
   "Подведу человека",
   "Испорчу отношения",
   "Меня сочтут слабым",
   "Меня сочтут плохим",
   "Станет хуже",
   "Буду виноват",
   "Другое",
   "Не знаю"
  ],
  "ruleAlternatives": [
   [
    "rule",
    "Это моё внутреннее правило"
   ],
   [
    "boundary",
    "Это про границу: другой нарушает договорённость"
   ],
   [
    "resource",
    "Это про нехватку сил"
   ],
   [
    "unknown",
    "Пока не знаю"
   ]
  ],
  "lastTime": [
   [
    "today",
    "Сегодня"
   ],
   [
    "week",
    "На этой неделе"
   ],
   [
    "earlier",
    "Раньше"
   ],
   [
    "unknown",
    "Не помню"
   ]
  ],
  "relations": [
   [
    "same",
    "Это текущий сюжет"
   ],
   [
    "similar",
    "Похоже, но другой человек"
   ],
   [
    "other",
    "Другое"
   ],
   [
    "unknown",
    "Не знаю"
   ]
  ],
  "linkQuestion": {
   "q": "Здесь похожая мысль или тот же внутренний запрет?",
   "opts": [
    [
     "yes",
     "Да, то же самое"
    ],
    [
     "no",
     "Нет, другое"
    ],
    [
     "unknown",
     "Не знаю"
    ]
   ]
  },
  "afterEvent": [
   [
    "help",
    "Помоги сейчас"
   ],
   [
    "save",
    "Просто записать"
   ],
   [
    "later",
    "Разобрать позже"
   ]
  ],
  "reviewDecisions": [
   {
    "id": "continue",
    "label": "Продолжить",
    "desc": "Тот же шаг и та же гипотеза ещё неделю."
   },
   {
    "id": "simplify",
    "label": "Упростить шаг",
    "desc": "Шаг слишком большой. Возьмём меньший."
   },
   {
    "id": "rehypo",
    "label": "Сменить гипотезу",
    "desc": "Объяснение не подтвердилось. Проверим другое."
   },
   {
    "id": "observe",
    "label": "Наблюдать",
    "desc": "Мало случаев. Просто записываем, что происходит."
   },
   {
    "id": "pause",
    "label": "Пауза",
    "desc": "Остановить работу с этим сюжетом на время."
   }
  ],
  "notHelpedReasons": [
   "Шаг слишком большой",
   "Неверная гипотеза",
   "Проблема требует внешнего решения",
   "Мало сил",
   "Не знаю"
  ],
  "hypothesisVerdict": [
   [
    "supported",
    "Подходит, узнаю"
   ],
   [
    "partial",
    "Отчасти"
   ],
   [
    "rejected",
    "Не подходит"
   ],
   [
    "unknown",
    "Пока не ясно"
   ]
  ],
  "help": {
   "safety": {
    "q": "Можешь сейчас остановиться в достаточно безопасном месте?",
    "opts": [
     [
      "yes",
      "Да"
     ],
     [
      "no",
      "Нет, ситуация небезопасна"
     ],
     [
      "harm",
      "Мне плохо, думаю причинить себе вред"
     ]
    ]
   },
   "unsafe": [
    "Отойди или прерви разговор, если это возможно.",
    "Обратись к человеку рядом, которому доверяешь.",
    "При угрозе здоровью или жизни звони в экстренные службы своей страны."
   ],
   "harm": [
    "Ты не один. Прямо сейчас важно связаться с живым человеком: близким, другом или службой помощи.",
    "Если есть угроза жизни, звони в экстренные службы своей страны или обратись в ближайшую больницу.",
    "Это приложение не заменяет помощь. Здесь нет заданий и наград для такого состояния."
   ],
   "methods": [
    [
     "grounding",
     "Опора вокруг",
     "почувствовать опору, заметить предметы, назвать чувство"
    ],
    [
     "breath",
     "Спокойное дыхание",
     "комфортный темп, без задержек"
    ],
    [
     "box",
     "Дыхание по квадрату",
     "вдох 4, задержка 4, выдох 4, задержка 4"
    ]
   ],
   "breathSteps": [
    "Дыши в удобном темпе. Не нужно глубоко и не нужно задерживать.",
    "Пусть выдох будет чуть длиннее вдоха, если это удобно.",
    "Если неприятно, прекрати и переключись на опору вокруг."
   ],
   "after": [
    [
     "better",
     "Легче"
    ],
    [
     "same",
     "Так же"
    ],
    [
     "worse",
     "Тяжелее"
    ],
    [
     "skip",
     "Не хочу оценивать"
    ]
   ],
   "power": [
    "Пауза",
    "Выйти из разговора",
    "Попросить помощь",
    "Другое"
   ],
   "medical": "Если появился новый, выраженный, нарастающий или стойкий телесный симптом, обратись за медицинской оценкой. Не нужно ждать окончания трека."
  },
  "paths": {
   "1": {
    "name": "Путь Воли",
    "theme": "самостоятельность, своё решение",
    "prompt": "Где я жду разрешения, хотя могу решить сам?"
   },
   "2": {
    "name": "Путь Партнёрства",
    "theme": "связь, чувствительность, границы",
    "prompt": "Где я забываю о себе ради связи?"
   },
   "3": {
    "name": "Путь Голоса",
    "theme": "самовыражение, радость",
    "prompt": "Что я не говорю вслух?"
   },
   "4": {
    "name": "Путь Основы",
    "theme": "порядок, труд, надёжность",
    "prompt": "Где я тяну больше, чем могу?"
   },
   "5": {
    "name": "Путь Свободы",
    "theme": "перемены, выбор, своё дело",
    "prompt": "Где я остаюсь там, где мне не по себе?"
   },
   "6": {
    "name": "Путь Заботы",
    "theme": "семья, ответственность",
    "prompt": "Где моя забота не по просьбе?"
   },
   "7": {
    "name": "Путь Глубины",
    "theme": "познание, внутренний мир",
    "prompt": "С кем я мог бы поделиться мыслями?"
   },
   "8": {
    "name": "Путь Силы",
    "theme": "деньги, результат, справедливость",
    "prompt": "Где я молчу о своих условиях?"
   },
   "9": {
    "name": "Путь Завершения",
    "theme": "отпускать, завершать",
    "prompt": "Что уже закончилось, а я держу?"
   }
  },
  "about": {
   "frame": "Карма, учитель, тропа и астролябия в приложении — образы. Они помогают пережить процесс: заметить повторяющийся сюжет, найти, что можно изменить в себе, и попробовать новый ответ. Число по дате рождения — символическая тема для размышления. Оно не определяет выводы о тебе, упражнения или результаты.",
   "method": "Под шагами лежат отдельные навыки самопомощи: дневник мысли, проверка версии, работа с жёсткими правилами, маленький поведенческий эксперимент, прямая просьба и отказ, план «если — то», возвращение опоры при сильной эмоции. Это адаптированные короткие упражнения, а не полные программы терапии. Их доказательная база не переносится автоматически на это приложение.",
   "limits": [
    "Приложение не ставит диагнозы и не лечит. Оно не заменяет психолога, врача или помощь близких.",
    "Карточки ситуаций — подсказки для памяти, а не тест. Число «цепляет» ничего не измеряет.",
    "Выбранное объяснение — рабочая версия, а не доказанная причина. Его можно отвергнуть.",
    "Правила флага и ясности неба — продуктовые ориентиры пилота, не медицинские критерии.",
    "По месту телесного ощущения нельзя назначить психологическую причину. Новый или стойкий симптом — повод к врачу.",
    "Все записи хранятся только на этом устройстве. Шифрования нет. Делай резервную копию в настройках."
   ],
   "extra": "Для добровольного углубления можно читать о проекции (Юнг), схемах (Янг), практике RAIN (Тара Брах) и «Работе» Байрон Кейти. В основной поток эти рамки не встроены и обязательным сеансом не являются."
  }
 }
};
