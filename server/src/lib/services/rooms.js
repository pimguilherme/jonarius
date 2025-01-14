const RoomPlayer = require("../models/room_player");
const Room = require("../models/room");
const Results = require("../models/results")
const io = require('../../ioserver');
const users = require("./users");



// This will contain all currently existing rooms
let rooms = [];

module.exports = class Rooms {



  static createRoom = ({ roomName, hostPlayer }) => {

    if (!hostPlayer) {
      console.log("Tentativa de criar uma sala com nome [%s] sem um jogador definido", roomName)
      return { error: 'Para criar uma sala é preciso de um jogador!' };
    }

    if (!roomName) {
      console.debug("Tentativa de criar uma sala sem nome [retorna alerta de erro]");
      return { error: 'Para criar uma sala é preciso da nome!' };
    }

    console.debug("Criando uma sala com nome [%s] para o hostPlayer [%s]", roomName, hostPlayer.name)
    roomName = roomName.trim();

    const existingRoom = Rooms.getRoom(roomName)
    console.debug("Procurando uma sala existente [%s]", existingRoom == undefined ? "Sala disponível" : "Sala indisponível")


    if (existingRoom) {
      console.debug("Usuário [%s] tentando criar uma sala com um nome já existente [%s]", hostPlayer.name, roomName);
      return { error: 'Uma sala com esse nome já existe!' };
    }

    // Isso é o que uma nova sala representa

    const room = new Room({ name: roomName, hostPlayer })

    rooms.push(room);
    console.log(room.deck)
    console.info("Sala criada com nome [%s] e host player [%s]", roomName, hostPlayer.name)

    return { room };

  }

  // FUNÇÂO ANTIGA DO PIM ???
  // static removeRoom = (roomName) => {
  //   console.info("Removendo usuário com nome [%s]", roomName)
  //   const index = rooms.findIndex((room) => room.name === roomName);

  //   if(index !== -1) return users.splice(index, 1)[0];
  // }

  static getRoom = (roomName) => {
    console.debug("Buscando uma sala com nome [%s]", roomName)
    return rooms.find((room) => room.name === roomName);
  }

  static getRooms = () => {
    return rooms;
  }

  static setRooms = (r) => {
    rooms = r || []
  }

  // Eu pedro mudei o conceito findIndex(user) para indexOf porque dava erro.
  static getRoomOfUser = (user) => {
    console.debug("verificando nome da sala do jogador [%s] se ele estiver em uma", user.name)
    return rooms.find(room => room.isUserInRoom(user))
  }

  static addUserToRoom = ({ room, user }) => {
    const isPlayerInRoom = !!Rooms.getRoomOfUser(user)

    console.debug("Tentando adicionar usuário [%s] na sala [%s]", user.name, room.name)
    if (isPlayerInRoom) {
      console.debug("Usuário [%s] já está em uma sala", user)
      return { error: "Você já está em uma sala em andamento." }
    }
    else if (room.isUserWithNameInRoom(user.name)) {
      console.debug("usuário [%s] tentando entrar na sala [%s] com nome já existente.", user.name, room.name)
      return { error: "esse nome de usuário já existe na sala!" }
    }
    else if (room.state !== "WAITING_FOR_PLAYERS") {
      console.debug("usuário [%s] tentando entrar na sala [%s] já em andamento", user.name, room.name)
      return { error: "Essa sala já começou a partida!" }
    }

    else {
      console.debug("Adicionando usuário [%s] à sala [%s]", user, room)
      room.players.push(new RoomPlayer({ user: user }))
    }

    return {}
  }

  static startGame = ({ user, room }) => {
    console.log("O jogador [%s] está iniciando o jogo na sala [%s]", user.id, room.name)
    console.log("Os decks do jogo são [%s] e a condicao de vitoria é [%s]", room.selectedDecksIds, room.victory)

    if (room.state != Room.States.WAITING_FOR_PLAYERS && room.state != Room.States.GAME_ENDED) {
      console.log("usuário [%s] está tentando iniciar o jogo na sala [%s] e o estado atual é [%s]", user.id, room.name, room.state)
      return { error: "Esse jogo ainda está rolando." }
    }

    // Temos jogadores o suficiente? :)
    if (room.players.length < room.minimumPlayersToStart) {
      console.log("usuário [%s] está tentando iniciar o jogo na sala [%s] com menos jogadores [%s] que o minimo [%s]", user.id, room.name, room.players.length, room.minimumPlayersToStart)
      return { error: `Você precisa de pelo menos ${room.minimumPlayersToStart} jogadores para começar!` }
    }
    // Temos cartas o suficiente? :)
    if (room.getTotalOfSelectedCards() < room.minimumCardsToStart) {
      console.log("usuário [%s] está tentando iniciar o jogo na sala [%s] com menos cartas [%s] que o minimo [%s]", user.id, room.name, room.getNumberOfSelectedCards(), room.minimumCardsToStart)
      return { error: `Você precisa de pelo menos ${room.minimumCardsToStart} cartas para começar!` }
    }




    if (room.state == Room.States.GAME_ENDED) {
      room.turn = 1
      room.players.forEach(player => {
        player.score = 0
        player.turnScore = 0
        player.hand = []
        player.mySelectedCard = null
        player.selectedCard = null
        player.votedCard = null
      })
      room.currentPlayerIndex = 0
      room.prompt = null
      room.selectedCardCount = 0
      room.results = []
      room.deck = []
    }

    console.log("Adicionando cartas dos decks selecionados ao baralho do jogo, com os baralhos!", room.selectedDecksIds.join(", "))

    // Adicionar cartas de cada deck :)
    room.getSelectedDecks().forEach(deck => {

      for (var i = 1; i <= deck.totalCards; i++) {
        let card = `${deck.deckPrefix}${i}`
        room.deck.push(card)
      }
    })

    console.log("Temos [%s] cartas para o deck da sala [%s]!", room.deck.length, room.id)

    Rooms.dealInitCardsWithoutReposition(room);
    room.players = shuffle(room.players)
    room.state = Room.States.PICKING_PROMPT


    console.log("A sala [%s] está agora no estado PICKING_PROMPT", room.id);

    return {}

  }

  static emitRoomDataForAll = (room, io) => {
    console.info("Emitindo roomData para os sockets conectados na sala [%s]", room.name)
    room.players.forEach((player) => {
      Rooms.emitRoomDataForPlayer(room, player, io)
    })
  }

  static getRoomDataForUser = ({ room, user }) => {
    let player = room.getPlayerForUser(user)
    return Rooms.getRoomDataForPlayer(room, player)
  }

  static getRoomDataForPlayer = (room, player) => {
    return {
      myUserName: player.user.name,
      myHand: player.hand,
      haveIVoted: player.votedCard,
      mySelectedCard: player.mySelectedCard,
      name: room.name,
      state: room.state,
      turn: room.turn,
      currentPlayerIndex: room.currentPlayerIndex,
      host: room.host,
      prompt: room.prompt,
      selectedCardCount: room.selectedCardCount,
      results: room.results,
      victory: room.victory,
      availableDecks: Room.AVAILABLE_DECKS,
      availableVictoryConditions: Room.POSSIBLE_VICTORY_CONDITIONS,
      minimumCardsToStart: room.minimumCardsToStart,
      minimumPlayersToStart: room.minimumPlayersToStart,
      selectedDecksIds: room.selectedDecksIds,
      votingCardsTurn: room.votingCardsTurn,
      players: room.players.map((player) => {
        return {
          name: player.user.name,
          id: player.user.id,
          score: player.score,
          selectedCard: room.state == Room.States.PICKING_PROMPT ? player.selectedCard : !!player.selectedCard,
          votedCard: room.state.PICKING_PROMPT ? player.votedCard : !!player.votedCard,
          isDisconnected: !player.user.socketIds.length
        }
      }),
      winner: room.winner,
    }
  }

  static setVictory = (victoryCondition, room) => {
    room.victory = victoryCondition
  }
  static toggleDeck = (deckId, room) => {
    console.log("Selecionando estado do deck [%s] para a sala [%s]", deckId, room.id)
    var index = room.selectedDecksIds.indexOf(deckId)
    if (index != -1) {
      console.log("Removendo o deck [%s] da sala [%s]", deckId, room.id)
      room.selectedDecksIds.splice(index, 1);
    } else {
      console.log("Adicionando o deck [%s] da sala [%s]", deckId, room.id)
      room.selectedDecksIds.push(deckId)
    }
  }

  static emitRoomDataForUserSocket = (room, user, socket) => {
    console.debug("emitindo RoomData para o usuário [%s] no socket [%s]", user.id, socket.id)
    var roomData = Rooms.getRoomDataForUser({ room, user })
    io.to(socket.id).emit('roomData', roomData)
  }

  static emitRoomDataForPlayer = (room, player, io) => {
    console.debug("emitindo RoomData para todos os sockets do usuário [%s]", player.user.id)
    var roomData = Rooms.getRoomDataForPlayer(room, player)
    player.user.socketIds.forEach((socketId) => {
      console.debug("emitindo roomData para o socket [%s] do usuário [%s]", socketId, player.user.id)
      io.to(socketId).emit('roomData', roomData)
    })
  }
  static setOnGoingGameRoomState = (room) => {
    room.state = RoomStates.ONGOING_GAME
  }

  static setGameState = (room, gameState) => {
    room.gameState = gameState
  }

  // SÓ CHAMAR QUANDO O GAME STARTAR - socket.on("gameStart")
  static dealInitCardsWithoutReposition = (room) => {
    console.debug("Começando a distribuir as cartas para os jogadores da sala [%s]", room.name)

    room.players.forEach(player => {
      console.debug("Distribuindo as cartas para o jogador [%s]", player.user.name)
      Rooms.shuffleAndDealCardsToPlayer({room, player, count: 6})
    })

    console.debug("Distribuição de cartas para os jogadores da sala [%s] concluída!", room.name)
  }

  // Embaralha o baralho e distribui N cartas para o jogador :)
  static shuffleAndDealCardsToPlayer = ({room, player, count}) => {
    // shuffle(room.deck);
    for (var i = 0; i < count; i++) {
      var randomCard = room.deck[0]
      console.log("SELECTED CARD: [%s]", room.deck[0])
      player.hand.push(randomCard)
      room.deck.splice(0, 1)
    }    
  }

  // Selecionar o prompt para um usuário da sala
  static setPromptForUser = ({ user, prompt, room }) => {
    console.log("Usuário [%s] escolhendo o prompt [%s] na mesa [%s]", user.id, prompt, room.name)

    // ATUALIZAR!!! Não foi implementado
    // if (room.players[room.currentPlayerIndex].name !== user.name) {
    //   //let currentPlayerUser = room.getCurrentPlayer().user
    //   console.warn("Usuário [] tentando escolher o prompt [%s] na mesa [] sem ser o jogador atual []!", /*user.id, prompt, room.name*/)
    //   return "Você precisa estar em um jogo para escolher o prompt!"
    // }

    room.prompt = prompt
    console.log("Usuário [%s] escolheu o prompt [%s] na mesa [%s], passando para o próximo estado!", user.id, prompt, room.name)
    room.state = Room.States.SELECTING_CARDS

  }

  // Recomprar as cartas para dar mais dinâmica ao jogo :)
  static redrawCardsForUser = ({ user, callback, room, io }) => {
    const player = room.getPlayerForUser(user)
    console.log("Usuário [%s] recomprando cartas na sala [%s], com [%d] carta(s) na mão!", user.id, room.name, player.hand.length)

    if (!(
        Room.States.PICKING_PROMPT == room.state || 
        (Room.States.SELECTING_CARDS == room.state && !player.selectedCard)
    )) {
      console.log("Usuário [%s] tentando recomprar a mão fora da hora na mesa [%s]", user.id, room.name)
      return callback("Você só pode recomprar sua mão durante a fase de escolha de frase ou de escolher cartas e você ainda não tiver escolhido!")
    } 

    if (player.lastRedrawTurn && player.lastRedrawTurn >= room.turn - 1) {
      console.log("Usuário [%s] tentando recomprar a mão antes de esperar duas rodadas na mesa [%s]", user.id, room.name)
      return callback("Você só pode recomprar sua mão a cada 2 rodadas!")
    }

    Rooms.sendSystemMessageToRoom({ io, message: `Ora, ora, ora.. ${user.name} recomprou sua mão!`, userRoom: room })

    // Remove as cartas da mão do jogador
    const oldPlayerHand = player.hand
    player.hand = []
    player.lastRedrawTurn = room.turn

    Rooms.shuffleAndDealCardsToPlayer({player, room, count: oldPlayerHand.length})
    
    // Coloca as cartas antigas do jogador no baralho novamente :)
    for (var card in oldPlayerHand) {
      room.deck.push(card)
    }
    
    console.log("Nova mão do usuário [%s] na sala [%s] tem [%d] carta(s) e é [%s]", user.id, room.name, player.hand.length, JSON.stringify(player.hand))
    console.log("O deck da sala [%s] tem [%d] carta(s)", room.name, room.deck.length)

  }

  // Selecionar uma carta para um determinado usuário em uma sala
  static setSelectedCardForUser = (user, room, card, callback, io) => {
    console.debug("Selecionar a carta [%s] para o usuário [%s] na sala [%s]", card, user.name, room.name)

    // Estado inválido para selecionar cartas!
    if (room.state != Room.States.SELECTING_CARDS) {
      console.warn("Usuário [%s] tentando escolher cartas quando o jogo está no estado [%s], na sala [%s]", user.id, room.state, room.name)
      return callback("Você não pode colocar uma carta agora!")
    }


    if (room.getSelectedCardForUser(user)) {
      console.warn("Usuário [%s] tentando selecionar uma carta [%s] após já ter selecionado uma carta!", user, card)
      return callback("Você já selecionou uma carta!")
    }

    room.setSelectedCardForUser(user, card)
    Rooms.sendSystemMessageToRoom({ io: io, userRoom: room, message: `${user.name} colocou uma carta na mesa!` })

    let totalSelectedCards = room.getNumberOfSelectedCards()
    console.debug("Carta [%s] escolhida para o jogador [%s] na sala [%s], agora temos um total de [%s] carta(s) e [%s] jogador(es)", card, user.id, room.name, totalSelectedCards, room.players.length)
    //
    // Todas as cartas já foram escolhidas? Então devemos passar de estado para VOTING :)
    if (totalSelectedCards >= room.players.length) {
      console.info("Cartas suficientes escolhidas na sala [%s], vamos passar de estado [%s]!", room.name, room.state)
      room.selectedCardCount = totalSelectedCards
      room.state = Room.States.VOTING
      room.votingCardsTurn = room.players.map((player) => { return player.selectedCard })
      shuffle(room.votingCardsTurn)
      Rooms.sendSystemMessageToRoom({ io: io, userRoom: room, message: `Já podem votar na carta` })
    } else {
      room.selectedCardCount = totalSelectedCards
      console.log('selectedCardCount :', room.selectedCardCount)
    }

  }

  // Escolhendo a carta votada para um determinado usuário :)
  static setVotedCardForUser = ({ user, card, room }, io) => {
    console.debug("Votando na carta [%s] para o usuário [%s] na sala [%s]", card, user.id, room.name)

    // Estado inválido para votar em cartas!
    if (room.state != Room.States.VOTING) {
      console.warn("Usuário [%s] tentando votar em cartas quando o jogo está no estado [%s], na sala [%s]", user.id, room.state, room.name)
      return ("Você não pode votar em uma carta nesse momento do jogo!")
    }

    if (room.getVotedCardForUser(user)) {
      console.warn("Usuário [%s] tentando votar uma carta [%s] após já ter votado uma carta!", user, card)
      return ("Você já votou em uma carta!")
    }

    if (card == room.getSelectedCardForUser(user)) {
      console.warn("Usuário [%s] tentando votar na própria carta [%s]", user, card)
      return ("Você não pode votar na sua carta!")
    }

    if (room.isCardAvailableForVoting(card)) {
      console.warn("Usuário [%s] tentando votar em uma carta [%s] que não está na votação na sala [%s]!", user, card, room)
      return ("Você está tentando votar em uma carta que não está em votação! Isso pode ser um bug :o ")
    }

    room.setVotedCardForUser(user, card)

    Rooms.sendSystemMessageToRoom({ io: io, userRoom: room, message: `${user.name} votou!` })
    let totalVotedCards = room.getNumberOfVotedCards()
    console.debug("Carta [%s] votada para o jogador [%s] na sala [%s], agora temos um total de [%s] carta(s) e [%s] jogador(es)", card, user.id, room.name, totalVotedCards, room.players.length)
    //
    // Todas as cartas já foram votadas? Então devemos passar de estado para PICKING_PROMPT :)
    // Com isso devemos também garantir que todos os usuários tem 5 cartas e que temos cartas suficientes, ou acabar o jogo :)
    if (totalVotedCards >= room.players.length - 1) {
      console.info("Cartas suficientes votadas na sala [%s], vamos passar de estado!", room.name)

      console.info("Pontuando jogadores da rodada!")
      // então hora de pontuar :)
      const currentPlayer = room.getCurrentPlayer()
      const otherPlayers = room.players.filter(p => p != currentPlayer)
      let numberOfCurrentPlayerCardVoted = otherPlayers.filter(p => p.votedCard == currentPlayer.selectedCard).length

      // Dá um ponto para cada jogador que teve sua carta votada, tirando o jogador atual
      otherPlayers.forEach(player => {
          otherPlayers.forEach(otherPlayer => {
            if (otherPlayer.votedCard == player.selectedCard) {
              player.score++
              player.turnScore++
            }
          })
      })

      // Algumas pessoas votaram na carta do jogador principal, mas não todas
      if ((numberOfCurrentPlayerCardVoted < otherPlayers.length) && (numberOfCurrentPlayerCardVoted > 0)) {
        console.debug('Algumas pessoas votaram na carta do jogador atual (%d/%d)', numberOfCurrentPlayerCardVoted, otherPlayers.length)
        currentPlayer.score += 3
        currentPlayer.turnScore += 3
        otherPlayers.forEach(player => {
          if (player.votedCard == currentPlayer.selectedCard) {
            player.score += 3
            player.turnScore += 3
          }
        })
      }
      // Ninguém ou todo mundo votou na carta do jogador principal
      // -- Damos apenas 2 pointos para todos os jogadores menos o principal
      else {
        console.debug('Ninguém ou todo mundo votou na carta do jogador atual (%d/%d)', numberOfCurrentPlayerCardVoted, otherPlayers.length)
        otherPlayers.forEach(player => {
            player.score += 2
            player.turnScore += 2
        })
      }
      // Temos cartas suficientes?
      if (room.deck.length < room.players.length) {
        if (room.victory == "deck-victory") {
          room.state = Room.States.GAME_ENDED
          let Scores = []
          room.players.map(player => {
            Scores.push(player.score)
          })
          console.info("a array de Scores é :", Scores)

          let highScore = Math.max.apply(Math, Scores)
          console.info("a maior pontuação é :", highScore)
          // DEFINIR UM VENCEDOR
          room.players.forEach(player => {
            if (player.score == highScore) {
              room.winner.push({ name: player.user.name, score: player.score })
              return console.info('o jogador [%s] fez mais de trinta pontos, ele é o vencedor', player.user.name)
            }
          })
          console.info('o vencedor no estilo deck-victory é [%s]', room.winner)

          return console.info("Não temos mais cartas suficientes no deck, o jogo mudou de estado para GAME_ENDED!")
        }
        else if (room.victory == "points-victory") {

          room.morto.forEach(card => {
            room.deck.push(card)
          })
          room.morto = []
        }
      }
      if (room.victory == "points-victory") {
        room.players.forEach(player => {
          if (player.score >= 30) {
            room.winner.push({ name: player.user.name, score: player.score })
            room.state = Room.States.GAME_ENDED

            return console.info('o jogador [%s] fez mais de trinta pontos, ele é o vencedor', player.user.name)
          }
        })
      }
      if (room.state !== "GAME_ENDED") {
        // Agora também precisamos distribuir mais cartas :)
        room.players.forEach(player => {
          console.debug("Distribuindo uma nova carta para o jogador [%s]", player.user.name)

          let randomCard = room.deck[0]
          if (room.deck.length > 0) {
            player.hand.push(randomCard)
            room.deck.splice(0, 1)
          }
        })

        // SALVANDO OS RESULTADOS DO TURNO
        room.results.push(
          new Results({
            turn: room.turn,
            turnPlayer: room.players[room.currentPlayerIndex].user.name,
            turnPlayerScore: room.players[room.currentPlayerIndex].turnScore,
            turnPrompt: room.prompt,
            turnPlayerCard: room.players[room.currentPlayerIndex].selectedCard,
            players: room.players.map((player) => { return { name: player.user.name, votedCard: player.votedCard, selectedCard: player.selectedCard, turnScore: player.turnScore } })
          }))

        // LIMPANDO AS VARIÁVEIS PARA O PRÓXIMO TURNO 
        room.selectedCardCount = 0
        console.log('limpando contador de cartas selecionadas na sala para room.selectedCardCount', room.selectedCardCount)
        room.mySelectedCard = null
        console.log('limpando informação da carta selecionada do jogador room.mySelectedCard', room.mySelectedCard)
        room.players.forEach(player => player.selectedCard = null)
        console.log('limpando informação de cartas selecionadas da array room.players')
        room.players.forEach(player => player.votedCard = null)
        console.log('limpando informação de cartas votadas da array room.players')
        room.players.forEach(player => player.turnScore = 0)
        console.log('limpando informação de pontos de room.players')

        // RODANDO O JOGADOR DA RODADA (currentPlayerIndex + 1)
        if (room.currentPlayerIndex < room.players.length - 1) {
          room.currentPlayerIndex += 1

        }
        else {
          room.currentPlayerIndex = 0
        }
        room.turn++
        console.log('avançando para o próximo turno [%s]', room.turn)
        room.prompt = null
        console.log('Passando a rodada de Picking Prompt para o jogador [%s]', room.players[room.currentPlayerIndex].user.name)
        room.state = Room.States.PICKING_PROMPT
        Rooms.sendSystemMessageToRoom({ io: io, userRoom: room, message: `${room.players[room.currentPlayerIndex].user.name} é a sua vez de matutar a epígrafe!` })
      }
    }

  }

  static sendUserMessageToRoom = ({ userRoom, user, message, io }) => {
    console.debug("Enviando mensagem [%s] do usuário [%s] para a sala [%s]", message, user.id, userRoom.name)
    io.to(userRoom.name).emit('message', {
      user: user.name,
      userId: user.id,
      text: message,
      systemMessage: false,
      date: new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
    });
  }

  static sendSystemMessageToRoom = ({ userRoom, message, io }) => {
    console.info("Enviando mensagem do sistema [%s] para a sala [%s]", message, userRoom.name)
    io.to(userRoom.name).emit('message', {
      user: 'Andrétnik',
      text: message,
      systemMessage: true,
      date: new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
    });
  }

  static removePlayerFromRoom = (userRoom, user, io) => {

    const player = userRoom.getPlayerForUser(user)

    if (userRoom.currentPlayerIndex == userRoom.players.length - 1) {
      userRoom.currentPlayerIndex = 0
    }
    const userIndex = userRoom.players.indexOf(player)
    userRoom.players.splice(userIndex, 1)
    console.log('Agora temos [%s] usuários na sala', userRoom.players.length)
    if (player.user.id == userRoom.host.id) {
      if (userRoom.players.length > 1) {
        userRoom.host = userRoom.players[0].user
        console.log('new host is: [%s]', userRoom.host)
        Rooms.sendSystemMessageToRoom({ io: io, userRoom, message: `${userRoom.players[0].user.name} está decidindo as configurações de sala.` })
      }
    }
    if (userRoom.players.length == 0) {
      console.log('numero de jogadores na sala [%s]', userRoom.players.length)
      console.log('Vamos deletar a sala [%s]', userRoom)
      this.removeRoom(userRoom)
    }



  }

  static removeRoom = (userRoom) => {
    let emptyRoomIndex = rooms.indexOf(userRoom)
    rooms.splice(emptyRoomIndex, 1)
    console.log('Sala [%s] removida, agora temos [%s] salas', userRoom.name, rooms.length)
  }
}



// Fisher-Yates Alghoritm aka Knuth Shuffle
function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}