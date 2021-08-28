const mongoose = require("mongoose");
mongoose.set("useNewUrlParser", true);
mongoose.set("useUnifiedTopology", true);
mongoose.set("useFindAndModify", false);
mongoose.set("useUnifiedTopology", true);

class Database {
    constructor() {
        this.connect();
    }

    connect() {
        mongoose
            .connect(
                "mongodb+srv://andrii:VzVFYRh2C-69k7*@cluster0.kwaba.mongodb.net/myFirstDatabase?retryWrites=true&w=majority"
            )
            .then(() => {
                console.log("database connection successful");
            })
            .catch((err) => {
                console.log("database connection error " + err);
            });
    }
}

module.exports = new Database();