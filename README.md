# Locker_app - API (Backend)

## Technology
[ExpressJs](https://expressjs.com/)


## List of endoints
| Endoint |Method  | Action | Admin only | Request | 
|--|--|--|--|--|
| /api/register | POST | Register a user | - |An object containing a nickname, a password, an email and a role| 
| /api/login | POST | Login a user | - |An object containing an email and a password| 
| /api/lobby | POST | Create a lobby | yes |An object containing a name for the lobby| 
| /api/lobby/:id/add-user | POST | Add a user in a lobby | yes |An object containing an email and a nickname| 
| /api/lobby/:id | POST | Add a message in a lobby | - |An object containing a message (its content)| 
| /api/lobby/:id | GET | Retrieve all messages from a lobby | - | - | 
| /api/lobby/:idLobby/:idMessage| GET | Retrieve a specific message from a lobby | - | - | 
| /api/users | GET | Retrieve all users from a lobby |* | - | 
| /api/users/:id | GET | Retrieve a specific user | *| - | 
| /api/lobby/:idLobby/remove-user | DELETE | Delete a user from a lobby | yes |An object containing a nickname, an email and an id| 
| /api/messages/:idMessage | DELETE | Delete a message |* |- | 
| /api/lobby/:idMessage | PATCH | Edit a message | *| An object containing the new content of the message| 

*Admin have extended power/permissions
## Author
Myriam K.

## License
This project is open-sourced software licensed under the [MIT](https://opensource.org/license/MIT).

