import $ from "jquery";
import _ from "lodash";
import PropTypes from "prop-types";
import React from "react";
import { connect } from "react-redux";

import ConditionalRender from "../../ConditionalRender";
import { openChart } from "../../actions/charts";
import { buildURLString } from "../../actions/url-utils";
import ColumnFilter from "../../filters/ColumnFilter";
import menuFuncs from "../dataViewerMenuUtils";
import { exports as gu } from "../gridUtils";
import serverState from "../serverStateManagement";

require("./ColumnMenu.css");

const { ROW_HEIGHT, SORT_PROPS } = gu;
const MOVE_COLS = [
  ["step-backward", serverState.moveToFront, "Move Column To Front", {}],
  ["caret-left", serverState.moveLeft, "Move Column Left", { fontSize: "1.2em", padding: 0, width: "1.3em" }],
  ["caret-right", serverState.moveRight, "Move Column Right", { fontSize: "1.2em", padding: 0, width: "1.3em" }],
  ["step-forward", serverState.moveToBack, "Move Column To Back", {}],
];

function buildCaretClass(caretPct = 90) {
  const lastCaretStyle = _.get($("head").find("style:last-child"), "0.innerHTML");
  if (_.endsWith(lastCaretStyle || "", ".column-toggle__dropdown::after {right: " + caretPct + "%}")) {
    return; // don't continually add styling if its already set
  }
  const finalCaretPct = _.isUndefined(caretPct) ? 90 : caretPct;
  let caretStyle = "<style>";
  caretStyle += ".column-toggle__dropdown::before {right: " + finalCaretPct + "%}";
  caretStyle += ".column-toggle__dropdown::after {right: " + finalCaretPct + "%}";
  caretStyle += "</style>";
  $("head").append(caretStyle);
}

function positionMenu(selectedToggle, menuDiv) {
  const currLeft = _.get(selectedToggle.offset(), "left", 0);
  const currTop = _.get(selectedToggle.offset(), "top", 0);
  const divWidth = menuDiv.width();
  const css = {};
  if (currLeft + divWidth > window.innerWidth) {
    const finalLeft = currLeft - (currLeft + divWidth + 20 - window.innerWidth);
    css.left = finalLeft;
    const overlapPct = (currLeft - (finalLeft - 20)) / divWidth;
    const caretPct = Math.floor(100 - overlapPct * 100);
    buildCaretClass(caretPct);
  } else {
    css.left = currLeft;
    buildCaretClass();
  }
  css.top = currTop + ROW_HEIGHT - 6;
  menuDiv.css(css);
}

function ignoreMenuClicks(e) {
  const colFilter = $("div.column-filter");
  if (colFilter && (colFilter.is(e.target) || colFilter.has(e.target).length > 0)) {
    return true; // ignore filter clicks
  }
  if (colFilter && $(e.target).hasClass("Select__option")) {
    return true; // ignore option selection
  }
  if (colFilter && e.target.nodeName === "svg") {
    return true; // ignore option selection
  }
  return false;
}

class ReactColumnMenu extends React.Component {
  constructor(props) {
    super(props);
    this.updatePosition = this.updatePosition.bind(this);
  }

  updatePosition() {
    if (!_.isNull(this.props.selectedCol)) {
      positionMenu($(`div.${this.props.selectedToggle}`), $(this._div));
    }
  }

  componentDidUpdate() {
    this.updatePosition();
  }

  render() {
    const { dataId, selectedCol, openChart } = this.props;
    if (!selectedCol) {
      return null;
    }
    const colCfg = _.find(this.props.columns, { name: selectedCol }) || {};
    const unlocked = _.get(colCfg, "locked", false) == false;
    let currDir = _.find(this.props.sortInfo, ([col, _dir]) => selectedCol === col);
    currDir = _.isUndefined(currDir) ? SORT_PROPS[2].dir : currDir[1];
    const openPopup = (type, height = 450, width = 500) => () => {
      if (menuFuncs.shouldOpenPopup(height, width)) {
        menuFuncs.open(
          buildURLString(menuFuncs.fullPath(`/dtale/popup/${type}`, dataId), {
            selectedCol,
          }),
          null,
          height,
          width
        );
      } else {
        openChart(
          _.assignIn(
            { type, title: _.capitalize(type) },
            _.pick(this.props, ["selectedCol", "propagateState", "columns"])
          )
        );
      }
    };
    const openFormatting = () =>
      this.props.propagateState({
        formattingOpen: true,
        selectedCols: [selectedCol],
      });
    const hideCol = () => {
      const hideCallback = () => {
        const updatedColumns = _.map(this.props.columns, c =>
          _.assignIn({}, c, c.name === selectedCol ? { visible: !c.visible } : {})
        );
        this.props.propagateState({ columns: updatedColumns });
      };
      serverState.toggleVisibility(dataId, selectedCol, hideCallback);
    };
    const deleteCol = () => {
      const yesAction = () =>
        this.props.propagateState(
          { columns: _.reject(this.props.columns, { name: selectedCol }) },
          serverState.deleteColumn(dataId, selectedCol)
        );
      const msg = `Are you sure you want to delete the column "${selectedCol}"?`;
      const title = `Delete column - ${selectedCol}`;
      openChart({ type: "confirm", title, msg, yesAction, size: "modal-sm" });
    };
    return (
      <div
        id="column-menu-div"
        className="column-toggle__dropdown"
        hidden={!this.props.columnMenuOpen}
        style={{ minWidth: "11em" }}
        ref={cm => (this._div = cm)}>
        <header>{`Column "${selectedCol}"`}</header>
        <ul>
          <li>
            <span className="toggler-action">
              <i className="fa fa-sort ml-4 mr-4" />
            </span>
            <div className="btn-group compact m-auto font-weight-bold column-sorting">
              {_.map(SORT_PROPS, ({ dir, col }) => {
                const active = dir === currDir;
                return (
                  <button
                    key={dir}
                    style={active ? {} : { color: "#565b68" }}
                    className={`btn btn-primary ${active ? "active" : ""} font-weight-bold`}
                    onClick={active ? _.noop : () => menuFuncs.updateSort([selectedCol], dir, this.props)}
                    disabled={active}>
                    {col.label}
                  </button>
                );
              })}
            </div>
          </li>
          <li>
            <span className="toggler-action">
              <i className="ico-swap-horiz" />
            </span>
            <div className="btn-group compact m-auto font-weight-bold column-sorting">
              {_.map(MOVE_COLS, ([icon, func, hint, icnStyle]) => (
                <button
                  key={icon}
                  style={_.assign({ color: "#565b68", width: "2em" }, icnStyle)}
                  className={`btn btn-primary font-weight-bold`}
                  onClick={func(selectedCol, this.props)}
                  title={hint}>
                  <i className={`fas fa-${icon}`} />
                </button>
              ))}
            </div>
          </li>
          <ConditionalRender display={unlocked}>
            <li>
              <span className="toggler-action">
                <button className="btn btn-plain" onClick={serverState.lockCols([selectedCol], this.props)}>
                  <i className="fa fa-lock ml-3 mr-4" />
                  <span className="font-weight-bold">Lock</span>
                </button>
              </span>
            </li>
          </ConditionalRender>
          <ConditionalRender display={!unlocked}>
            <li>
              <span className="toggler-action">
                <button className="btn btn-plain" onClick={serverState.unlockCols([selectedCol], this.props)}>
                  <i className="fa fa-lock-open ml-2 mr-4" />
                  <span className="font-weight-bold">Unlock</span>
                </button>
              </span>
            </li>
          </ConditionalRender>
          <li>
            <span className="toggler-action">
              <button className="btn btn-plain" onClick={hideCol}>
                <i className="ico-visibility-off" />
                <span className="font-weight-bold">Hide</span>
              </button>
            </span>
          </li>
          <li>
            <span className="toggler-action">
              <button className="btn btn-plain" onClick={deleteCol}>
                <i className="ico-delete" />
                <span className="font-weight-bold">Delete</span>
              </button>
            </span>
          </li>
          <li>
            <span className="toggler-action">
              <button className="btn btn-plain" onClick={openPopup("describe", 670, 1100)}>
                <i className="ico-view-column" />
                <span className="font-weight-bold">Describe</span>
              </button>
            </span>
          </li>
          <li>
            <span className="toggler-action">
              <button className="btn btn-plain" onClick={openPopup("column-analysis", 425, 810)}>
                <i className="ico-equalizer" />
                <span className="font-weight-bold">Column Analysis</span>
              </button>
            </span>
          </li>
          <li>
            <span className="toggler-action">
              <button className="btn btn-plain" onClick={openFormatting}>
                <i className="ico-palette" />
                <span className="font-weight-bold">Formats</span>
              </button>
            </span>
          </li>
          <ColumnFilter {...this.props} />
        </ul>
      </div>
    );
  }
}
ReactColumnMenu.displayName = "ReactColumnMenu";
ReactColumnMenu.propTypes = {
  selectedCol: PropTypes.string,
  selectedToggle: PropTypes.string,
  columns: PropTypes.array,
  columnMenuOpen: PropTypes.bool,
  sortInfo: PropTypes.array,
  propagateState: PropTypes.func,
  dataId: PropTypes.string.isRequired,
  noInfo: PropTypes.bool,
  openChart: PropTypes.func,
};

const ReduxColumnMenu = connect(
  state => _.pick(state, ["dataId", "columnMenuOpen", "selectedCol", "selectedToggle"]),
  dispatch => ({ openChart: chartProps => dispatch(openChart(chartProps)) })
)(ReactColumnMenu);

export { ReduxColumnMenu as ColumnMenu, ReactColumnMenu, positionMenu, ignoreMenuClicks };
