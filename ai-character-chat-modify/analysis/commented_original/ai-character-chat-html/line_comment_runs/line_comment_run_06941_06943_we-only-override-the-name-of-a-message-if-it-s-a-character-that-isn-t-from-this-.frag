        // we only override the `name` of a message if it's a character that *isn't from this thread* - since otherwise there's no way for the custom code to get the actual name.
        // NOTE: I think this will actually cause the name to get written into to the message itself when the custom code iframe sends the data back, right? Yeah. Because the diff algorithm will notice that the name doesn't match the messages.
        // That seems okay, I guess? Just a byproduct of having custom code that needs to read thread-external characters.
