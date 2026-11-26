"""Metadata-rich library catalog.

Every record describes a real, published book. Facts (author, first
publication year, characters, plot) are deliberately limited to well-known,
widely documented details. Duplicate records are intentional and labelled:
  * "Frankenstein" appears twice: the 1818 first edition and Mary Shelley's
    revised 1831 edition (a real, separately published text).
  * "Pride and Prejudice" appears twice: a second catalogue copy, as a real
    library would hold.
Similar titles ("The Invisible Man" / "Invisible Man", the Harry Potter
series, several "The Adventures of ...") exercise ambiguity handling.

The list order IS the insertion order; record ids are assigned from it.
"""

from __future__ import annotations

from typing import TypedDict


class Character(TypedDict):
    name: str
    description: str


class Book(TypedDict, total=False):
    title: str
    authors: list[str]
    genre: str
    year: int
    characters: list[Character]
    plot: str
    themes: list[str]
    settings: list[str]
    note: str


def c(name: str, description: str) -> Character:
    return {"name": name, "description": description}


BOOKS: list[Book] = [
    {
        "title": "Pride and Prejudice",
        "authors": ["Jane Austen"],
        "genre": "Romance",
        "year": 1813,
        "characters": [
            c("Elizabeth Bennet", "witty, independent second daughter of the Bennet family"),
            c("Fitzwilliam Darcy", "proud, wealthy gentleman of Pemberley"),
            c("Jane Bennet", "gentle eldest Bennet sister"),
            c("Charles Bingley", "amiable rich friend of Darcy"),
            c("George Wickham", "charming militia officer who deceives others"),
        ],
        "plot": "Elizabeth Bennet's first impression of the proud Mr. Darcy is poor, and she is misled by "
        "Wickham's stories about him. As misunderstandings are cleared and Darcy helps her family "
        "after her sister Lydia elopes, the two overcome pride and prejudice and marry.",
        "themes": ["love", "marriage", "class", "pride", "first impressions", "family"],
        "settings": ["Longbourn", "Pemberley", "Hertfordshire", "Regency England", "countryside"],
    },
    {
        "title": "Sense and Sensibility",
        "authors": ["Jane Austen"],
        "genre": "Romance",
        "year": 1811,
        "characters": [
            c("Elinor Dashwood", "sensible, reserved elder sister"),
            c("Marianne Dashwood", "passionate, romantic younger sister"),
            c("Edward Ferrars", "quiet man Elinor loves"),
            c("Colonel Brandon", "steady older gentleman devoted to Marianne"),
            c("John Willoughby", "dashing suitor who abandons Marianne"),
        ],
        "plot": "After their father's death the Dashwood sisters and their mother move to a cottage in "
        "Devonshire. Elinor hides her feelings for Edward while Marianne gives her heart openly to "
        "Willoughby, who jilts her; both sisters learn to balance reason and emotion before finding love.",
        "themes": ["love", "reason versus emotion", "money", "marriage", "sisters"],
        "settings": ["Barton Cottage", "Devonshire", "London", "Regency England"],
    },
    {
        "title": "Emma",
        "authors": ["Jane Austen"],
        "genre": "Romance",
        "year": 1815,
        "characters": [
            c("Emma Woodhouse", "clever, wealthy young woman who loves matchmaking"),
            c("George Knightley", "sensible neighbour and old family friend"),
            c("Harriet Smith", "naive young friend Emma tries to match"),
            c("Frank Churchill", "charming young man with a secret engagement"),
        ],
        "plot": "Emma Woodhouse meddles in the romances of her friends in the village of Highbury, "
        "misreading everyone's affections. Her mistakes humble her and she realises she loves Mr. Knightley.",
        "themes": ["matchmaking", "self-knowledge", "class", "love", "village society"],
        "settings": ["Highbury", "Hartfield", "Regency England", "village"],
    },
    {
        "title": "Persuasion",
        "authors": ["Jane Austen"],
        "genre": "Romance",
        "year": 1817,
        "characters": [
            c("Anne Elliot", "thoughtful daughter persuaded years ago to refuse a proposal"),
            c("Frederick Wentworth", "naval captain Anne once refused"),
            c("Sir Walter Elliot", "Anne's vain, spendthrift father"),
        ],
        "plot": "Eight years after being persuaded to break her engagement to Frederick Wentworth, Anne "
        "Elliot meets him again, now a successful naval captain. Old feelings return, and after a letter "
        "from Wentworth in Bath they are reunited.",
        "themes": ["second chances", "regret", "constancy", "persuasion", "navy"],
        "settings": ["Bath", "Lyme Regis", "Kellynch Hall", "Regency England"],
    },
    {
        "title": "A Study in Scarlet",
        "authors": ["Arthur Conan Doyle"],
        "genre": "Mystery",
        "year": 1887,
        "characters": [
            c("Sherlock Holmes", "brilliant consulting detective who solves crimes by deduction"),
            c("Dr. John Watson", "army doctor back from Afghanistan; Holmes's friend and narrator"),
            c("Inspector Lestrade", "Scotland Yard detective"),
            c("Jefferson Hope", "the man behind the murders, seeking revenge"),
        ],
        "plot": "Watson meets Sherlock Holmes and they share rooms at 221B Baker Street. Holmes investigates "
        "a body found in an empty house with the word RACHE written in blood, and unmasks a killer whose "
        "motive of revenge lies in events years earlier in Utah.",
        "themes": ["deduction", "revenge", "friendship", "crime"],
        "settings": ["London", "221B Baker Street", "Utah", "Victorian England"],
    },
    {
        "title": "The Sign of the Four",
        "authors": ["Arthur Conan Doyle"],
        "genre": "Mystery",
        "year": 1890,
        "characters": [
            c("Sherlock Holmes", "consulting detective"),
            c("Dr. John Watson", "Holmes's companion, who falls in love with Mary Morstan"),
            c("Mary Morstan", "young woman who receives a pearl every year from an unknown sender"),
            c("Jonathan Small", "one-legged convict tied to a stolen treasure"),
        ],
        "plot": "Mary Morstan asks Holmes for help after years of receiving mysterious pearls. The trail "
        "leads to a murder, the lost Agra treasure from India and a chase down the River Thames.",
        "themes": ["treasure", "greed", "justice", "deduction"],
        "settings": ["London", "River Thames", "India", "Victorian England"],
    },
    {
        "title": "The Adventures of Sherlock Holmes",
        "authors": ["Arthur Conan Doyle"],
        "genre": "Mystery",
        "year": 1892,
        "characters": [
            c("Sherlock Holmes", "detective with remarkable powers of observation, often pictured in a deerstalker cap with a pipe"),
            c("Dr. John Watson", "narrator and loyal friend"),
            c("Irene Adler", "clever woman who outwits Holmes in A Scandal in Bohemia"),
        ],
        "plot": "Twelve short stories of Holmes's cases, including A Scandal in Bohemia, The Red-Headed "
        "League and The Speckled Band, in which he solves puzzling crimes through observation and logic.",
        "themes": ["deduction", "crime", "short stories", "friendship"],
        "settings": ["London", "221B Baker Street", "Victorian England"],
    },
    {
        "title": "The Hound of the Baskervilles",
        "authors": ["Arthur Conan Doyle"],
        "genre": "Mystery",
        "year": 1902,
        "characters": [
            c("Sherlock Holmes", "detective investigating a family curse"),
            c("Dr. John Watson", "sent ahead to protect the heir"),
            c("Sir Henry Baskerville", "heir to Baskerville Hall"),
            c("Jack Stapleton", "naturalist living on the moor"),
        ],
        "plot": "After Sir Charles Baskerville dies, apparently frightened to death, legend blames a "
        "spectral hound. Holmes and Watson protect the new heir on Dartmoor and expose a very human plot.",
        "themes": ["legend", "superstition versus reason", "inheritance", "deduction"],
        "settings": ["Dartmoor", "Baskerville Hall", "Devon", "moor"],
    },
    {
        "title": "The Valley of Fear",
        "authors": ["Arthur Conan Doyle"],
        "genre": "Mystery",
        "year": 1915,
        "characters": [
            c("Sherlock Holmes", "detective"),
            c("Professor Moriarty", "Holmes's criminal mastermind nemesis"),
            c("John Douglas", "owner of Birlstone Manor"),
        ],
        "plot": "A coded warning leads Holmes to a killing at Birlstone Manor; the story then turns to a "
        "secret society in an American coal-mining valley, with Moriarty's influence behind events.",
        "themes": ["secret society", "deduction", "revenge"],
        "settings": ["Birlstone Manor", "Sussex", "Pennsylvania", "coal valley"],
    },
    {
        "title": "Frankenstein",
        "authors": ["Mary Shelley"],
        "genre": "Gothic Horror",
        "year": 1818,
        "characters": [
            c("Victor Frankenstein", "young scientist who creates life"),
            c("The Creature", "the being Victor creates and abandons"),
            c("Robert Walton", "Arctic explorer who hears Victor's story"),
            c("Elizabeth Lavenza", "Victor's adopted sister and later wife"),
        ],
        "plot": "Victor Frankenstein builds a creature from parts of dead bodies, brings it to life and then "
        "rejects it. Lonely and spurned, the creature takes revenge on Victor's family, and Victor pursues it "
        "into the Arctic.",
        "themes": ["creation", "ambition", "isolation", "responsibility", "science"],
        "settings": ["Geneva", "Ingolstadt", "Arctic", "Switzerland"],
        "note": "First edition (1818).",
    },
    {
        "title": "Dracula",
        "authors": ["Bram Stoker"],
        "genre": "Gothic Horror",
        "year": 1897,
        "characters": [
            c("Count Dracula", "ancient vampire nobleman from Transylvania"),
            c("Jonathan Harker", "solicitor who visits Dracula's castle"),
            c("Mina Murray", "Jonathan's fiancée, later wife"),
            c("Abraham Van Helsing", "Dutch professor who hunts the vampire"),
            c("Lucy Westenra", "Mina's friend, Dracula's victim"),
        ],
        "plot": "Told through letters and diaries, the novel follows Count Dracula's move from Transylvania "
        "to England and the group led by Van Helsing who hunts him back to his castle.",
        "themes": ["vampires", "good versus evil", "fear", "modernity"],
        "settings": ["Transylvania", "Eastern Europe", "Whitby", "London", "castle"],
    },
    {
        "title": "Strange Case of Dr Jekyll and Mr Hyde",
        "authors": ["Robert Louis Stevenson"],
        "genre": "Gothic Horror",
        "year": 1886,
        "characters": [
            c("Dr Henry Jekyll", "respected doctor who experiments with a potion"),
            c("Edward Hyde", "violent man who is Jekyll's other self"),
            c("Gabriel John Utterson", "lawyer who investigates"),
        ],
        "plot": "The lawyer Utterson investigates the link between his friend Dr Jekyll and the cruel Mr "
        "Hyde, discovering that Jekyll's potion transforms him into Hyde.",
        "themes": ["duality", "good and evil", "science", "identity"],
        "settings": ["London", "Victorian England"],
    },
    {
        "title": "Treasure Island",
        "authors": ["Robert Louis Stevenson"],
        "genre": "Adventure",
        "year": 1883,
        "characters": [
            c("Jim Hawkins", "boy from the Admiral Benbow inn who narrates"),
            c("Long John Silver", "one-legged ship's cook and pirate with a parrot"),
            c("Captain Smollett", "honest captain of the Hispaniola"),
            c("Ben Gunn", "marooned former pirate"),
        ],
        "plot": "Jim Hawkins finds a treasure map and sails on the Hispaniola to a distant island. The crew "
        "includes pirates led by Long John Silver, who mutiny in search of Captain Flint's gold.",
        "themes": ["pirates", "treasure", "coming of age", "loyalty"],
        "settings": ["Treasure Island", "Hispaniola", "Admiral Benbow inn", "sea"],
    },
    {
        "title": "Kidnapped",
        "authors": ["Robert Louis Stevenson"],
        "genre": "Adventure",
        "year": 1886,
        "characters": [
            c("David Balfour", "young man cheated of his inheritance"),
            c("Alan Breck Stewart", "Jacobite adventurer"),
            c("Ebenezer Balfour", "David's miserly uncle"),
        ],
        "plot": "David Balfour's uncle has him kidnapped onto a ship. Shipwrecked, David travels across the "
        "Scottish Highlands with Alan Breck while fleeing accusations of murder, then reclaims his estate.",
        "themes": ["inheritance", "friendship", "loyalty", "journey"],
        "settings": ["Scotland", "Scottish Highlands", "sea"],
    },
    {
        "title": "Oliver Twist",
        "authors": ["Charles Dickens"],
        "genre": "Classic Fiction",
        "year": 1838,
        "characters": [
            c("Oliver Twist", "orphan boy raised in a workhouse"),
            c("Fagin", "leader of a gang of child pickpockets"),
            c("The Artful Dodger", "skilled young pickpocket"),
            c("Bill Sikes", "brutal burglar"),
            c("Nancy", "young woman in Fagin's gang who helps Oliver"),
        ],
        "plot": "Orphan Oliver Twist escapes the workhouse and falls in with Fagin's gang of pickpockets in "
        "London. With Nancy's help he is rescued and his true family is discovered.",
        "themes": ["poverty", "orphans", "crime", "innocence"],
        "settings": ["London", "workhouse", "Victorian England"],
    },
    {
        "title": "A Christmas Carol",
        "authors": ["Charles Dickens"],
        "genre": "Classic Fiction",
        "year": 1843,
        "characters": [
            c("Ebenezer Scrooge", "miserly old businessman"),
            c("Jacob Marley", "Scrooge's dead partner who returns as a ghost"),
            c("Bob Cratchit", "Scrooge's poorly paid clerk"),
            c("Tiny Tim", "Cratchit's ill young son"),
        ],
        "plot": "On Christmas Eve the miser Scrooge is visited by Marley's ghost and three spirits of "
        "Christmas Past, Present and Yet to Come, and wakes a changed, generous man.",
        "themes": ["redemption", "generosity", "christmas", "ghosts"],
        "settings": ["London", "Victorian England", "christmas"],
    },
    {
        "title": "David Copperfield",
        "authors": ["Charles Dickens"],
        "genre": "Classic Fiction",
        "year": 1850,
        "characters": [
            c("David Copperfield", "narrator who grows from child to writer"),
            c("Mr. Micawber", "cheerful, always-in-debt friend"),
            c("Uriah Heep", "scheming, falsely humble clerk"),
            c("Betsey Trotwood", "David's formidable great-aunt"),
        ],
        "plot": "David Copperfield recounts his life from an unhappy childhood with a cruel stepfather, "
        "through work in a London warehouse and his aunt's care, to becoming a successful novelist.",
        "themes": ["coming of age", "family", "perseverance", "class"],
        "settings": ["London", "Dover", "Yarmouth", "Victorian England"],
    },
    {
        "title": "A Tale of Two Cities",
        "authors": ["Charles Dickens"],
        "genre": "Historical Fiction",
        "year": 1859,
        "characters": [
            c("Sydney Carton", "dissolute lawyer who makes a great sacrifice"),
            c("Charles Darnay", "French aristocrat who renounces his family"),
            c("Lucie Manette", "kind young woman loved by Carton and Darnay"),
            c("Madame Defarge", "revolutionary who knits names of the condemned"),
        ],
        "plot": "Set in London and Paris before and during the French Revolution, the story ends with "
        "Sydney Carton taking Charles Darnay's place at the guillotine.",
        "themes": ["sacrifice", "revolution", "resurrection", "justice"],
        "settings": ["London", "Paris", "French Revolution"],
    },
    {
        "title": "Great Expectations",
        "authors": ["Charles Dickens"],
        "genre": "Classic Fiction",
        "year": 1861,
        "characters": [
            c("Pip", "orphan who becomes a gentleman"),
            c("Miss Havisham", "jilted woman who still wears her wedding dress"),
            c("Estella", "cold, beautiful girl raised by Miss Havisham"),
            c("Abel Magwitch", "escaped convict and Pip's secret benefactor"),
            c("Joe Gargery", "kind blacksmith"),
        ],
        "plot": "The orphan Pip receives a fortune from an unknown benefactor and moves to London to become "
        "a gentleman, only to learn the money comes from the convict he once helped.",
        "themes": ["ambition", "class", "guilt", "loyalty"],
        "settings": ["Kent marshes", "London", "Satis House"],
    },
    {
        "title": "Jane Eyre",
        "authors": ["Charlotte Brontë"],
        "genre": "Gothic Romance",
        "year": 1847,
        "characters": [
            c("Jane Eyre", "orphaned governess of strong principle"),
            c("Edward Rochester", "brooding master of Thornfield Hall"),
            c("Bertha Mason", "Rochester's wife, hidden in the attic"),
            c("St. John Rivers", "clergyman who proposes to Jane"),
        ],
        "plot": "Orphan Jane Eyre survives a harsh school, becomes governess at Thornfield Hall and falls in "
        "love with Mr. Rochester, but leaves when she discovers his secret wife. She later returns to him.",
        "themes": ["independence", "love", "morality", "class"],
        "settings": ["Thornfield Hall", "Lowood School", "England", "moors"],
    },
    {
        "title": "Wuthering Heights",
        "authors": ["Emily Brontë"],
        "genre": "Gothic Romance",
        "year": 1847,
        "characters": [
            c("Heathcliff", "foundling consumed by love and revenge"),
            c("Catherine Earnshaw", "spirited woman Heathcliff loves"),
            c("Edgar Linton", "refined man Catherine marries"),
            c("Nelly Dean", "housekeeper who narrates much of the story"),
        ],
        "plot": "Heathcliff, taken in by the Earnshaw family, loves Catherine, who marries Edgar Linton. "
        "His revenge stretches across two generations on the Yorkshire moors.",
        "themes": ["obsession", "revenge", "love", "class"],
        "settings": ["Wuthering Heights", "Thrushcross Grange", "Yorkshire moors"],
    },
    {
        "title": "Moby-Dick",
        "authors": ["Herman Melville"],
        "genre": "Adventure",
        "year": 1851,
        "characters": [
            c("Ishmael", "sailor and narrator"),
            c("Captain Ahab", "whaling captain with a leg of whalebone obsessed with the white whale"),
            c("Queequeg", "harpooner and Ishmael's friend"),
            c("Starbuck", "cautious first mate"),
        ],
        "plot": "Ishmael joins the whaling ship Pequod, whose Captain Ahab is bent on revenge against Moby "
        "Dick, the white whale that took his leg. The hunt ends in the ship's destruction.",
        "themes": ["obsession", "revenge", "nature", "fate"],
        "settings": ["Pequod", "Nantucket", "sea", "ocean"],
    },
    {
        "title": "The Adventures of Tom Sawyer",
        "authors": ["Mark Twain"],
        "genre": "Adventure",
        "year": 1876,
        "characters": [
            c("Tom Sawyer", "mischievous, imaginative boy"),
            c("Huckleberry Finn", "Tom's free-spirited friend"),
            c("Becky Thatcher", "girl Tom admires"),
            c("Injun Joe", "murderer Tom and Huck witness"),
            c("Aunt Polly", "Tom's aunt who raises him"),
        ],
        "plot": "Tom Sawyer tricks friends into whitewashing a fence, witnesses a murder in a graveyard with "
        "Huck, gets lost in a cave with Becky and finds a treasure.",
        "themes": ["childhood", "adventure", "freedom", "morality"],
        "settings": ["St. Petersburg, Missouri", "Mississippi River", "cave"],
    },
    {
        "title": "Adventures of Huckleberry Finn",
        "authors": ["Mark Twain"],
        "genre": "Adventure",
        "year": 1884,
        "characters": [
            c("Huckleberry Finn", "boy who fakes his death to escape his father"),
            c("Jim", "enslaved man escaping to freedom"),
            c("Tom Sawyer", "Huck's friend"),
            c("The Duke and the King", "two con men"),
        ],
        "plot": "Huck Finn escapes his abusive father and travels down the Mississippi on a raft with Jim, "
        "who is fleeing slavery, meeting swindlers and feuding families along the way.",
        "themes": ["freedom", "slavery", "friendship", "morality"],
        "settings": ["Mississippi River", "raft", "American South"],
    },
    {
        "title": "Alice's Adventures in Wonderland",
        "authors": ["Lewis Carroll"],
        "genre": "Fantasy",
        "year": 1865,
        "characters": [
            c("Alice", "curious young girl"),
            c("The White Rabbit", "anxious rabbit with a pocket watch"),
            c("The Cheshire Cat", "grinning cat who vanishes"),
            c("The Mad Hatter", "host of an endless tea party"),
            c("The Queen of Hearts", "queen who shouts 'Off with her head!'"),
        ],
        "plot": "Alice follows the White Rabbit down a rabbit hole into Wonderland, changes size, attends a "
        "mad tea party and faces the Queen of Hearts' trial before waking up.",
        "themes": ["nonsense", "childhood", "curiosity", "dreams"],
        "settings": ["Wonderland", "rabbit hole"],
    },
    {
        "title": "Through the Looking-Glass",
        "authors": ["Lewis Carroll"],
        "genre": "Fantasy",
        "year": 1871,
        "characters": [
            c("Alice", "girl who steps through a mirror"),
            c("The Red Queen", "chess queen who runs to stay in place"),
            c("Tweedledum and Tweedledee", "quarrelling twins"),
            c("Humpty Dumpty", "egg who argues about words"),
        ],
        "plot": "Alice climbs through a mirror into a world laid out like a chessboard and advances from "
        "pawn to queen, meeting strange characters along the way.",
        "themes": ["nonsense", "chess", "logic", "dreams"],
        "settings": ["Looking-Glass world", "chessboard"],
    },
    {
        "title": "Twenty Thousand Leagues Under the Seas",
        "authors": ["Jules Verne"],
        "genre": "Science Fiction",
        "year": 1870,
        "characters": [
            c("Captain Nemo", "mysterious commander of the submarine Nautilus"),
            c("Professor Pierre Aronnax", "French marine biologist and narrator"),
            c("Ned Land", "Canadian harpooner"),
            c("Conseil", "Aronnax's devoted servant"),
        ],
        "plot": "Hunting a supposed sea monster, Professor Aronnax and his companions are captured aboard "
        "Captain Nemo's submarine, the Nautilus, and travel the world's oceans.",
        "themes": ["exploration", "science", "the sea", "freedom"],
        "settings": ["Nautilus", "ocean", "under the sea", "submarine"],
    },
    {
        "title": "Around the World in Eighty Days",
        "authors": ["Jules Verne"],
        "genre": "Adventure",
        "year": 1872,
        "characters": [
            c("Phileas Fogg", "precise English gentleman"),
            c("Passepartout", "Fogg's French valet"),
            c("Detective Fix", "policeman who suspects Fogg of robbery"),
            c("Aouda", "Indian woman Fogg rescues"),
        ],
        "plot": "Phileas Fogg wagers his fellow Reform Club members that he can travel around the world in "
        "eighty days, racing by train and steamship while pursued by Detective Fix.",
        "themes": ["travel", "punctuality", "wager", "adventure"],
        "settings": ["London", "Reform Club", "India", "around the world"],
    },
    {
        "title": "Journey to the Centre of the Earth",
        "authors": ["Jules Verne"],
        "genre": "Science Fiction",
        "year": 1864,
        "characters": [
            c("Professor Otto Lidenbrock", "impatient German geology professor"),
            c("Axel", "his nephew and narrator"),
            c("Hans", "calm Icelandic guide"),
        ],
        "plot": "Professor Lidenbrock decodes a runic message and leads Axel and Hans down an Icelandic "
        "volcano into an underground world, finally returning to the surface through a volcano in Italy.",
        "themes": ["exploration", "science", "underground"],
        "settings": ["Iceland", "volcano", "underground", "Hamburg"],
    },
    {
        "title": "The Time Machine",
        "authors": ["H. G. Wells"],
        "genre": "Science Fiction",
        "year": 1895,
        "characters": [
            c("The Time Traveller", "English inventor who builds a time machine"),
            c("Weena", "Eloi woman the Traveller befriends"),
            c("The Eloi", "gentle future people"),
            c("The Morlocks", "underground creatures who prey on the Eloi"),
        ],
        "plot": "The Time Traveller journeys to the year 802,701 and finds humanity split into the childlike "
        "Eloi and the subterranean Morlocks, then travels further toward the dying Earth.",
        "themes": ["time travel", "class", "evolution", "future"],
        "settings": ["future", "year 802,701", "England"],
    },
    {
        "title": "The Invisible Man",
        "authors": ["H. G. Wells"],
        "genre": "Science Fiction",
        "year": 1897,
        "characters": [
            c("Griffin", "scientist who makes himself invisible"),
            c("Dr. Kemp", "former classmate Griffin turns to"),
        ],
        "plot": "A bandaged stranger arrives in the village of Iping. He is Griffin, a scientist who has made "
        "himself invisible, and his inability to reverse it drives him to violence.",
        "themes": ["science", "power", "isolation", "madness"],
        "settings": ["Iping", "English village", "England"],
    },
    {
        "title": "The War of the Worlds",
        "authors": ["H. G. Wells"],
        "genre": "Science Fiction",
        "year": 1898,
        "characters": [
            c("The Narrator", "unnamed writer living in Woking"),
            c("The Martians", "invaders in giant tripod fighting-machines"),
        ],
        "plot": "Martians land near Woking and attack England with tripods and heat-rays. Humanity cannot "
        "stop them, but the invaders are finally killed by Earth's bacteria.",
        "themes": ["invasion", "imperialism", "survival", "science"],
        "settings": ["Woking", "London", "England"],
    },
    {
        "title": "The Picture of Dorian Gray",
        "authors": ["Oscar Wilde"],
        "genre": "Gothic Fiction",
        "year": 1890,
        "characters": [
            c("Dorian Gray", "handsome young man who stays youthful"),
            c("Basil Hallward", "artist who paints Dorian's portrait"),
            c("Lord Henry Wotton", "witty aristocrat who influences Dorian"),
            c("Sibyl Vane", "young actress Dorian loves"),
        ],
        "plot": "Dorian Gray wishes that his portrait would age instead of him. He stays young while the "
        "painting records every sin of his corrupt life.",
        "themes": ["beauty", "vanity", "morality", "art"],
        "settings": ["London", "Victorian England"],
    },
    {
        "title": "The Wonderful Wizard of Oz",
        "authors": ["L. Frank Baum"],
        "genre": "Fantasy",
        "year": 1900,
        "characters": [
            c("Dorothy Gale", "girl from Kansas"),
            c("Toto", "Dorothy's little dog"),
            c("The Scarecrow", "wants a brain"),
            c("The Tin Woodman", "wants a heart"),
            c("The Cowardly Lion", "wants courage"),
        ],
        "plot": "A cyclone carries Dorothy from Kansas to the Land of Oz. She follows the yellow brick road "
        "to the Emerald City with companions seeking a brain, a heart and courage.",
        "themes": ["home", "friendship", "courage", "journey"],
        "settings": ["Kansas", "Land of Oz", "Emerald City", "yellow brick road"],
    },
    {
        "title": "Anne of Green Gables",
        "authors": ["L. M. Montgomery"],
        "genre": "Children's Fiction",
        "year": 1908,
        "characters": [
            c("Anne Shirley", "talkative, imaginative red-haired orphan"),
            c("Marilla Cuthbert", "stern woman who adopts Anne"),
            c("Matthew Cuthbert", "Marilla's shy, kind brother"),
            c("Gilbert Blythe", "classmate and rival"),
        ],
        "plot": "The Cuthberts plan to adopt a boy to help on their farm but receive Anne Shirley instead. "
        "Her imagination and mishaps win over the village of Avonlea.",
        "themes": ["belonging", "imagination", "growing up", "friendship"],
        "settings": ["Avonlea", "Green Gables", "Prince Edward Island", "farm"],
    },
    {
        "title": "Little Women",
        "authors": ["Louisa May Alcott"],
        "genre": "Classic Fiction",
        "year": 1868,
        "characters": [
            c("Jo March", "tomboyish sister who wants to be a writer"),
            c("Meg March", "eldest, responsible sister"),
            c("Beth March", "shy, gentle sister"),
            c("Amy March", "artistic youngest sister"),
            c("Laurie", "the March sisters' wealthy neighbour"),
        ],
        "plot": "The four March sisters grow up in New England while their father serves in the American "
        "Civil War, facing poverty, ambition and love.",
        "themes": ["sisterhood", "family", "growing up", "ambition"],
        "settings": ["Concord", "Massachusetts", "New England", "American Civil War"],
    },
    {
        "title": "The Mysterious Affair at Styles",
        "authors": ["Agatha Christie"],
        "genre": "Mystery",
        "year": 1920,
        "characters": [
            c("Hercule Poirot", "Belgian detective with a moustache who relies on his little grey cells"),
            c("Arthur Hastings", "Poirot's friend and narrator"),
            c("Emily Inglethorp", "wealthy woman who is poisoned"),
        ],
        "plot": "In Hercule Poirot's first case, wealthy Emily Inglethorp is poisoned at Styles Court in "
        "Essex, and Poirot untangles a family's secrets to find the killer.",
        "themes": ["poison", "inheritance", "deduction"],
        "settings": ["Styles Court", "Essex", "country house", "England"],
    },
    {
        "title": "The Great Gatsby",
        "authors": ["F. Scott Fitzgerald"],
        "genre": "Classic Fiction",
        "year": 1925,
        "characters": [
            c("Jay Gatsby", "mysterious millionaire who throws lavish parties"),
            c("Nick Carraway", "narrator and Gatsby's neighbour"),
            c("Daisy Buchanan", "woman Gatsby loves"),
            c("Tom Buchanan", "Daisy's wealthy husband"),
        ],
        "plot": "Nick Carraway watches his neighbour Jay Gatsby try to win back Daisy Buchanan in the summer "
        "of 1922, a pursuit that ends in tragedy.",
        "themes": ["american dream", "wealth", "love", "class"],
        "settings": ["West Egg", "Long Island", "New York", "Jazz Age"],
    },
    {
        "title": "The Murder of Roger Ackroyd",
        "authors": ["Agatha Christie"],
        "genre": "Mystery",
        "year": 1926,
        "characters": [
            c("Hercule Poirot", "retired detective growing marrows"),
            c("Dr. James Sheppard", "village doctor and narrator"),
            c("Roger Ackroyd", "wealthy man who is murdered"),
        ],
        "plot": "Hercule Poirot, retired to the village of King's Abbot, investigates the murder of Roger "
        "Ackroyd, leading to one of crime fiction's most famous twist endings.",
        "themes": ["deception", "blackmail", "deduction"],
        "settings": ["King's Abbot", "English village"],
    },
    {
        "title": "Brave New World",
        "authors": ["Aldous Huxley"],
        "genre": "Dystopian",
        "year": 1932,
        "characters": [
            c("Bernard Marx", "misfit psychologist"),
            c("John the Savage", "man raised outside the World State"),
            c("Lenina Crowne", "worker at the hatchery"),
            c("Mustapha Mond", "World Controller"),
        ],
        "plot": "In a future World State where people are engineered and kept content with the drug soma, "
        "John the Savage is brought from a reservation and rebels against its emptiness.",
        "themes": ["control", "technology", "happiness", "individuality"],
        "settings": ["World State", "London", "future"],
    },
    {
        "title": "Murder on the Orient Express",
        "authors": ["Agatha Christie"],
        "genre": "Mystery",
        "year": 1934,
        "characters": [
            c("Hercule Poirot", "Belgian detective with a moustache"),
            c("Samuel Ratchett", "American passenger found stabbed"),
            c("Mary Debenham", "governess travelling on the train"),
        ],
        "plot": "When the Orient Express is stopped by a snowdrift, a passenger is found stabbed in his "
        "compartment. Poirot discovers links to a past kidnapping and an unexpected solution.",
        "themes": ["justice", "revenge", "deduction"],
        "settings": ["Orient Express", "train", "snowdrift", "Yugoslavia"],
    },
    {
        "title": "Death on the Nile",
        "authors": ["Agatha Christie"],
        "genre": "Mystery",
        "year": 1937,
        "characters": [
            c("Hercule Poirot", "detective on holiday in Egypt"),
            c("Linnet Doyle", "rich heiress who is murdered"),
            c("Simon Doyle", "Linnet's new husband"),
            c("Jacqueline de Bellefort", "Simon's jilted former fiancée"),
        ],
        "plot": "On a Nile steamer in Egypt, the newly married heiress Linnet Doyle is shot. Poirot, a "
        "fellow passenger, investigates a jealous former fiancée and others on board.",
        "themes": ["jealousy", "greed", "love", "deduction"],
        "settings": ["Egypt", "River Nile", "steamer", "Karnak"],
    },
    {
        "title": "The Hobbit",
        "authors": ["J. R. R. Tolkien"],
        "genre": "Fantasy",
        "year": 1937,
        "characters": [
            c("Bilbo Baggins", "home-loving hobbit"),
            c("Gandalf", "wizard who recruits Bilbo"),
            c("Thorin Oakenshield", "leader of the dwarves"),
            c("Smaug", "dragon guarding treasure"),
            c("Gollum", "creature who loses a magic ring"),
        ],
        "plot": "Bilbo Baggins joins Gandalf and thirteen dwarves on a quest to reclaim the Lonely Mountain "
        "from the dragon Smaug, finding a magic ring along the way.",
        "themes": ["adventure", "courage", "greed", "home"],
        "settings": ["Middle-earth", "the Shire", "Lonely Mountain", "Mirkwood"],
    },
    {
        "title": "Rebecca",
        "authors": ["Daphne du Maurier"],
        "genre": "Gothic Fiction",
        "year": 1938,
        "characters": [
            c("The second Mrs de Winter", "young, unnamed narrator"),
            c("Maxim de Winter", "widower and owner of Manderley"),
            c("Mrs Danvers", "sinister housekeeper devoted to Rebecca"),
        ],
        "plot": "A young woman marries the widower Maxim de Winter and moves to his estate, Manderley, where "
        "she lives in the shadow of his first wife, Rebecca, and her housekeeper Mrs Danvers.",
        "themes": ["jealousy", "identity", "memory", "secrets"],
        "settings": ["Manderley", "Cornwall", "Monte Carlo", "estate"],
    },
    {
        "title": "And Then There Were None",
        "authors": ["Agatha Christie"],
        "genre": "Mystery",
        "year": 1939,
        "characters": [
            c("Vera Claythorne", "former governess"),
            c("Justice Lawrence Wargrave", "retired judge"),
            c("Philip Lombard", "soldier of fortune"),
        ],
        "plot": "Ten strangers are invited to an island off the Devon coast and accused of past crimes. They "
        "are killed one by one in a pattern following a nursery rhyme.",
        "themes": ["guilt", "justice", "isolation"],
        "settings": ["Soldier Island", "island", "Devon"],
    },
    {
        "title": "Animal Farm",
        "authors": ["George Orwell"],
        "genre": "Political Satire",
        "year": 1945,
        "characters": [
            c("Napoleon", "pig who seizes power"),
            c("Snowball", "idealistic pig driven out by Napoleon"),
            c("Boxer", "loyal, hard-working cart-horse"),
            c("Squealer", "pig who spreads propaganda"),
        ],
        "plot": "The animals of Manor Farm overthrow their human farmer, but the pigs gradually become as "
        "tyrannical as the humans they replaced.",
        "themes": ["power", "corruption", "revolution", "propaganda"],
        "settings": ["Manor Farm", "Animal Farm", "farm"],
    },
    {
        "title": "Nineteen Eighty-Four",
        "authors": ["George Orwell"],
        "genre": "Dystopian",
        "year": 1949,
        "characters": [
            c("Winston Smith", "Party worker who secretly rebels"),
            c("Julia", "woman who becomes Winston's lover"),
            c("O'Brien", "Inner Party member"),
            c("Big Brother", "the Party's ever-watching leader"),
        ],
        "plot": "In Oceania, where Big Brother watches everyone, Winston Smith rewrites history at the "
        "Ministry of Truth, rebels with Julia, and is caught and broken in Room 101.",
        "themes": ["surveillance", "totalitarianism", "truth", "control"],
        "settings": ["Oceania", "Airstrip One", "London", "Ministry of Truth", "future"],
    },
    {
        "title": "The Lion, the Witch and the Wardrobe",
        "authors": ["C. S. Lewis"],
        "genre": "Fantasy",
        "year": 1950,
        "characters": [
            c("Lucy Pevensie", "youngest child, first to find Narnia"),
            c("Edmund Pevensie", "brother tempted by the witch"),
            c("Aslan", "great lion"),
            c("The White Witch", "queen who keeps Narnia in endless winter"),
        ],
        "plot": "Four children evacuated from London find a wardrobe leading to Narnia, frozen in winter by "
        "the White Witch, and help the lion Aslan defeat her.",
        "themes": ["good versus evil", "sacrifice", "betrayal", "magic"],
        "settings": ["Narnia", "wardrobe", "England"],
    },
    {
        "title": "Invisible Man",
        "authors": ["Ralph Ellison"],
        "genre": "Literary Fiction",
        "year": 1952,
        "characters": [
            c("The Narrator", "unnamed Black man who feels invisible to society"),
            c("Dr. Bledsoe", "college president"),
            c("Ras the Exhorter", "black nationalist"),
        ],
        "plot": "An unnamed Black narrator recounts his life from a Southern college to Harlem, where he "
        "joins a political group called the Brotherhood, and his realisation that society does not see him.",
        "themes": ["identity", "race", "invisibility", "society"],
        "settings": ["Harlem", "New York", "American South"],
    },
    {
        "title": "Fahrenheit 451",
        "authors": ["Ray Bradbury"],
        "genre": "Dystopian",
        "year": 1953,
        "characters": [
            c("Guy Montag", "fireman whose job is burning books"),
            c("Clarisse McClellan", "curious teenage neighbour"),
            c("Captain Beatty", "Montag's fire chief"),
            c("Mildred Montag", "Montag's wife"),
        ],
        "plot": "In a future where firemen burn books, Guy Montag begins to question his work, steals books "
        "and flees to join exiles who memorise them.",
        "themes": ["censorship", "books", "conformity", "knowledge"],
        "settings": ["future", "American city"],
    },
    {
        "title": "The Fellowship of the Ring",
        "authors": ["J. R. R. Tolkien"],
        "genre": "Fantasy",
        "year": 1954,
        "characters": [
            c("Frodo Baggins", "hobbit who inherits the One Ring"),
            c("Samwise Gamgee", "Frodo's loyal gardener"),
            c("Gandalf", "wizard"),
            c("Aragorn", "ranger and heir to the throne"),
        ],
        "plot": "Frodo Baggins inherits the One Ring and sets out from the Shire. At Rivendell a Fellowship "
        "forms to destroy it, travelling through Moria before breaking apart.",
        "themes": ["friendship", "courage", "power", "quest"],
        "settings": ["Middle-earth", "the Shire", "Rivendell", "Moria"],
    },
    {
        "title": "To Kill a Mockingbird",
        "authors": ["Harper Lee"],
        "genre": "Classic Fiction",
        "year": 1960,
        "characters": [
            c("Scout Finch", "young girl and narrator"),
            c("Atticus Finch", "principled lawyer and Scout's father"),
            c("Jem Finch", "Scout's older brother"),
            c("Boo Radley", "reclusive neighbour"),
            c("Tom Robinson", "Black man falsely accused"),
        ],
        "plot": "In 1930s Alabama, Scout Finch watches her father Atticus defend Tom Robinson, a Black man "
        "wrongly accused of rape, while she and Jem are fascinated by their neighbour Boo Radley.",
        "themes": ["justice", "racism", "childhood", "courage"],
        "settings": ["Maycomb", "Alabama", "American South"],
    },
    {
        "title": "The Hitchhiker's Guide to the Galaxy",
        "authors": ["Douglas Adams"],
        "genre": "Science Fiction",
        "year": 1979,
        "characters": [
            c("Arthur Dent", "ordinary Englishman in his dressing gown"),
            c("Ford Prefect", "alien researcher for the Guide"),
            c("Zaphod Beeblebrox", "two-headed President of the Galaxy"),
            c("Marvin", "depressed robot"),
        ],
        "plot": "Seconds before Earth is demolished for a hyperspace bypass, Arthur Dent is rescued by his "
        "friend Ford Prefect and travels the galaxy, learning that the answer to everything is 42.",
        "themes": ["absurdity", "space travel", "humour", "meaning of life"],
        "settings": ["space", "Heart of Gold", "Magrathea", "Earth"],
    },
    {
        "title": "The Talisman",
        "authors": ["Stephen King", "Peter Straub"],
        "genre": "Fantasy",
        "year": 1984,
        "characters": [
            c("Jack Sawyer", "twelve-year-old boy on a quest"),
            c("Wolf", "gentle werewolf companion"),
            c("Morgan Sloat", "Jack's father's scheming business partner"),
        ],
        "plot": "To save his dying mother, Jack Sawyer travels across America and a parallel world called "
        "the Territories in search of a magical Talisman.",
        "themes": ["quest", "parallel worlds", "friendship", "courage"],
        "settings": ["the Territories", "America", "parallel world"],
    },
    {
        "title": "Good Omens",
        "authors": ["Terry Pratchett", "Neil Gaiman"],
        "genre": "Fantasy",
        "year": 1990,
        "characters": [
            c("Aziraphale", "angel and rare-book dealer"),
            c("Crowley", "demon who drives a vintage Bentley"),
            c("Adam Young", "boy who is the Antichrist"),
            c("Anathema Device", "descendant of the prophetess Agnes Nutter"),
        ],
        "plot": "An angel and a demon who have grown fond of life on Earth team up to stop the coming "
        "Apocalypse, but they have lost track of the Antichrist, a boy growing up in Tadfield.",
        "themes": ["apocalypse", "good versus evil", "friendship", "free will", "humour"],
        "settings": ["Tadfield", "London", "England"],
    },
    {
        "title": "Harry Potter and the Philosopher's Stone",
        "authors": ["J. K. Rowling"],
        "genre": "Fantasy",
        "year": 1997,
        "characters": [
            c("Harry Potter", "orphaned boy wizard with a lightning-bolt scar"),
            c("Hermione Granger", "brilliant student"),
            c("Ron Weasley", "Harry's loyal best friend"),
            c("Albus Dumbledore", "headmaster of Hogwarts"),
            c("Rubeus Hagrid", "half-giant gamekeeper"),
        ],
        "plot": "On his eleventh birthday Harry Potter learns he is a wizard and goes to Hogwarts School, "
        "where he and his friends stop Voldemort from obtaining the Philosopher's Stone.",
        "themes": ["friendship", "courage", "magic", "good versus evil", "school"],
        "settings": ["Hogwarts", "Privet Drive", "Diagon Alley", "school"],
    },
    {
        "title": "Harry Potter and the Chamber of Secrets",
        "authors": ["J. K. Rowling"],
        "genre": "Fantasy",
        "year": 1998,
        "characters": [
            c("Harry Potter", "young wizard"),
            c("Ginny Weasley", "Ron's younger sister"),
            c("Dobby", "house-elf who tries to warn Harry"),
            c("Tom Riddle", "the young Voldemort preserved in a diary"),
        ],
        "plot": "In Harry's second year, students at Hogwarts are found petrified. Harry discovers the "
        "Chamber of Secrets, defeats a basilisk and destroys Tom Riddle's diary.",
        "themes": ["courage", "prejudice", "friendship", "magic"],
        "settings": ["Hogwarts", "Chamber of Secrets", "school"],
    },
    {
        "title": "Harry Potter and the Prisoner of Azkaban",
        "authors": ["J. K. Rowling"],
        "genre": "Fantasy",
        "year": 1999,
        "characters": [
            c("Harry Potter", "young wizard"),
            c("Sirius Black", "escaped prisoner and Harry's godfather"),
            c("Remus Lupin", "Defence Against the Dark Arts teacher"),
            c("Peter Pettigrew", "the real traitor, hiding as a rat"),
        ],
        "plot": "Sirius Black escapes the prison of Azkaban and is believed to be hunting Harry. Harry "
        "learns the truth about his parents' betrayal and uses a Time-Turner to save Sirius.",
        "themes": ["friendship", "betrayal", "time", "family"],
        "settings": ["Hogwarts", "Azkaban", "Hogsmeade", "school"],
    },
    {
        "title": "Frankenstein",
        "authors": ["Mary Shelley"],
        "genre": "Gothic Horror",
        "year": 1831,
        "characters": [
            c("Victor Frankenstein", "young scientist who creates life"),
            c("The Creature", "the being Victor creates and abandons"),
            c("Robert Walton", "Arctic explorer who hears Victor's story"),
        ],
        "plot": "Mary Shelley's revised text of her novel, with a new introduction describing how the story "
        "was conceived. Victor Frankenstein creates a living being, abandons it, and is pursued by its revenge.",
        "themes": ["creation", "ambition", "isolation", "responsibility", "science"],
        "settings": ["Geneva", "Ingolstadt", "Arctic", "Switzerland"],
        "note": "Revised edition (1831). Same title as the 1818 first edition; kept as a separate catalogue record.",
    },
    {
        "title": "Pride and Prejudice",
        "authors": ["Jane Austen"],
        "genre": "Romance",
        "year": 1813,
        "characters": [
            c("Elizabeth Bennet", "witty, independent second daughter of the Bennet family"),
            c("Fitzwilliam Darcy", "proud, wealthy gentleman of Pemberley"),
        ],
        "plot": "Elizabeth Bennet and Mr. Darcy overcome pride, prejudice and misunderstandings to marry.",
        "themes": ["love", "marriage", "class", "pride"],
        "settings": ["Longbourn", "Pemberley", "Regency England"],
        "note": "Second catalogue copy of the first Pride and Prejudice record (duplicate title kept as its own record).",
    },
]


# Intended readership, used as a search facet. Only books written for or
# primarily published as children's books are marked; everything else is
# "General". (Extended-catalogue records derive this from reader shelves.)
CHILDREN = {
    "Alice's Adventures in Wonderland", "Through the Looking-Glass", "The Wonderful Wizard of Oz",
    "The Lion, the Witch and the Wardrobe", "The Hobbit", "Anne of Green Gables", "Treasure Island",
    "Harry Potter and the Philosopher's Stone", "Harry Potter and the Chamber of Secrets",
    "Harry Potter and the Prisoner of Azkaban",
}
for _b in BOOKS:
    _b["audience"] = "Children" if _b["title"] in CHILDREN else "General"

