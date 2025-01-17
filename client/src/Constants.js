
module.exports = {

    // Para onde vamos nos conectar?
    apiSocketPath: process.env.REACT_APP_API_SOCKET_PATH || '/socket.io' ,
    apiAddress: process.env.REACT_APP_API_ADDRESS || 'http://localhost:5000',

    // Isso define os possiveis estados de um jogo / sala
    RoomStates: {
        WAITING_FOR_PLAYERS: "WAITING_FOR_PLAYERS",
        ONGOING_GAME: "ONGOING_GAME",
        PICKING_PROMPT: "PICKING_PROMPT",
        SELECTING_CARDS: "SELECTING_CARDS",
        VOTING: "VOTING",
        GAME_ENDED: "GAME_ENDED"
    },

    DragTypes: {
        PICKING_CARD: 'picking-card'
    },

    // Textos diferentes para deixar as coisas mais divertidas :)
    Texts: {

        PickingPrompt: [
            '%s tá matutano aquele bordão solerte',
            '%s tá com o tico e teco a todo vapor pensano na frase',
            '%s tá lembrando como se escreve pra soltar a frase',
            '%s tá queimando a mufa pra fazer a gente rir',
            '%s tá pesquisando no google um sinônimo pra solerte'
        ]

    }
}