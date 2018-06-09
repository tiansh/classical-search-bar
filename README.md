# Classical Search Bar

[Avaliable on AMO](https://addons.mozilla.org/en-US/firefox/addon/classical-search-bar/)

## Usage

Due to the limitation of Firefox, web extensions may not read your search engine list nor chose default search engine for you. This extension act as a search engine, and redirect your searching to the real search engine you have chosen. After installation, you need the following actions to make this extension work:

1. config this extension as the default search engine in Firefox options;
2. open add-on option page, edit the search engine list to meet your requirements;
3. customize your firefox ui, move the "Search By..." button to a better place (on the left side of search bar is suggested).

## Development

For anyone who want modify the source code and test it, here is a short guide:

This extension do not relay on any compiling process, no need of babel, npm, yarn, nor anything. All you need is
1. Download the source code;
2. Load it as temporary extension in Firefox by open `about:debugging#addons` page, click "Load Temporary Add-on" and chose the manifest.json file in extension folder;
3. And then modify it as you like. (do not forget to reload it after modification)

## Translation

If you want help us translate this extension to your language, make a pull request on GitHub. You may also open an issue and upload the translated file if you do not familiar with git.

All translation should be placed in `/extension/_locales/&lt;language-code&gt;/messages.json`. You may create a new file based on the English one. Only `"message"` need to be translated, all `"description"` should be deleted in translated versions. Please refer the instructions in the development section to test your translations.

## Privacy

We collect nothing.

## License

All source code and materials of this extension is licensed under the Mozilla Public License 2.0.

Search engine icons included in the source code may contain tread marks.
