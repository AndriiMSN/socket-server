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
                "mongodb://myUserAdmin:password@157.245.89.26:27017/chat?authSource=admin&readPreference=primary&appname=MongoDB%20Compass&ssl=false"
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